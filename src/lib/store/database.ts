import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export interface Database {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  execute(sql: string): Promise<void>;
  close(): Promise<void>;
  dumpDataDirectory?():Promise<Uint8Array>;
}

export async function embeddedDatabase(directory?: string,archive?:Uint8Array): Promise<Database> {
  const client = new PGlite(directory,archive?{loadDataDir:new Blob([new Uint8Array(archive)])}:{});
  await client.waitReady;
  return {
    async query<T>(sql: string, values: unknown[] = []) {
      return (await client.query(sql, values)).rows as T[];
    },
    async execute(sql: string) { await client.exec(sql); },
    async close() { await client.close(); },
    async dumpDataDirectory(){return new Uint8Array(await(await client.dumpDataDir('gzip')).arrayBuffer());},
  };
}

// Explicit CLI/server configuration owns the credentials. No automatic cloud fallback.
export async function postgresDatabase(url: string): Promise<Database> {
  const { default: postgres } = await import("postgres");
  const address=new URL(url),local=['','localhost','127.0.0.1','[::1]'].includes(address.hostname);
  const caFile=process.env.BOOKCLUB_DATABASE_CA_CERT;
  const tls=local?undefined:{rejectUnauthorized:true,...(caFile?{ca:await readFile(/* turbopackIgnore: true */ caFile,'utf8')}:{})};
  const sql = postgres(url, {
    max: 1, connect_timeout: 10, onnotice: () => {},
    // postgres.js sslmode=require disables certificate verification by default.
    // Hosted connections always verify the peer; a private provider CA is opt-in.
    ...(tls?{ssl:tls}:{}),
    // Database callers pass JSON.stringify(payload), the same wire form used by
    // PGlite. postgres.js otherwise stringifies an inferred json/jsonb parameter
    // again, turning an object into a JSON string only in hosted installations.
    types:{json:{to:114,from:[114,3802],serialize:(value:unknown)=>typeof value==='string'?value:JSON.stringify(value),parse:JSON.parse}},
  });
  return {
    async query<T>(query: string, values: unknown[] = []) {
      return await sql.unsafe(query, values as never[]) as unknown as T[];
    },
    async execute(query: string) { await sql.unsafe(query).simple(); },
    async close() { await sql.end(); },
  };
}

export async function migrate(db: Database, migrations = path.resolve("db/migrations")) {
  const [known] = await db.query<{ ledger: string | null }>("SELECT to_regclass('public.schema_migrations')::text AS ledger");
  if (!known.ledger) {
    const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    if (tables.length) throw new Error("Refusing to initialize a nonempty, unrecognized database. Choose a new empty database.");
    await db.execute("CREATE TABLE schema_migrations(name TEXT PRIMARY KEY, sha256 TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()); REVOKE ALL ON schema_migrations FROM PUBLIC;");
  }
  const applied = await db.query<{name: string; sha256: string}>("SELECT name,sha256 FROM schema_migrations ORDER BY name");
  const files = (await readdir(migrations)).filter((f) => /^\d+_[a-z0-9_-]+\.sql$/.test(f)).sort();
  for (const row of applied) if (!files.includes(row.name)) throw new Error("Database uses an unsupported newer migration: " + row.name);
  for (const file of files) {
    const body = await readFile(path.join(migrations, file), "utf8"), digest = createHash("sha256").update(body).digest("hex");
    const prior = applied.find((row) => row.name === file);
    if (prior) { if (prior.sha256 !== digest) throw new Error("Migration checksum changed: " + file); continue; }
    await db.execute("BEGIN");
    try {
      await db.execute(body);
      await db.query("INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)", [file,digest]);
      await db.execute("COMMIT");
    } catch (error) { await db.execute("ROLLBACK"); throw error; }
  }
}

// Server startup is read-only. Only the owner setup command applies migrations.
export async function verifyMigrations(db:Database,migrations=path.resolve('db/migrations')){
  const applied=await db.query<{name:string;sha256:string}>('SELECT name,sha256 FROM schema_migrations ORDER BY name');
  const files=(await readdir(migrations)).filter(f=>/^\d+_[a-z0-9_-]+\.sql$/.test(f)).sort();
  if(applied.length!==files.length)throw new Error('The database needs a compatible application version or an owner-run migration. Back it up before upgrading.');
  for(let i=0;i<files.length;i++){
    const digest=createHash('sha256').update(await readFile(path.join(migrations,files[i]))).digest('hex');
    if(applied[i].name!==files[i]||applied[i].sha256!==digest)throw new Error('The database migration ledger does not match this application. Use the matching release; do not edit the ledger.');
  }
}
