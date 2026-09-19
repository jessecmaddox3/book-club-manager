import { randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile,rename } from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { embeddedDatabase, migrate, type Database } from "./database";

type Marker = { kind: "book-club-manager-demo"; storageVersion: 1; state:'initializing'|'ready'; instanceId: string; sessionSecret: string };
export type LocalStore = { db: Database; instanceId: string; sessionSecret: string; close(): Promise<void> };

export async function openDemoStore(directory: string,options:{migrate?:boolean}={}): Promise<LocalStore> {
  const root = path.resolve(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("The demo directory must be an ordinary local folder.");
  let release: () => Promise<void>;
  try { release = await lockfile.lock(root, { stale: 30000, update: 10000, retries: 0, realpath: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOCKED") throw new Error("This demo is already open. Stop its other terminal before running a second copy or a CLI command. After a forced crash, wait 30 seconds before trying again.");
    throw error;
  }
  let db: Database | undefined;
  try {
    const markerFile = path.join(root, "instance.json");
    let marker: Marker;
    const children = await readdir(root);
    if (!children.length) {
      marker = { kind: "book-club-manager-demo", storageVersion: 1, state:'initializing', instanceId: randomUUID(), sessionSecret: randomBytes(48).toString("base64url") };
      await writeFile(markerFile, JSON.stringify(marker) + "\n", { flag: "wx", mode: 0o600 });
    } else {
      const file = await lstat(markerFile).catch(() => null);
      if (!file?.isFile() || file.isSymbolicLink()) throw new Error("Unrecognized data folder. Choose an empty folder; existing files will not be replaced.");
      marker = JSON.parse(await readFile(markerFile,"utf8"));
      if (marker.kind !== "book-club-manager-demo" || marker.storageVersion !== 1 || !['initializing','ready'].includes(marker.state) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(marker.instanceId) || typeof marker.sessionSecret !== "string" || marker.sessionSecret.length < 48) throw new Error("This demo's storage marker is corrupt or from an unsupported version. Restore a backup; it will not be reset automatically.");
      if(marker.state!=='ready')throw new Error('The first database setup was interrupted. Preserve this folder and choose a new empty folder, or restore a backup. It will not be reset automatically.');
    }
    const dataPath = path.join(root,"database");
    const dataInfo = await lstat(dataPath).catch(() => null);
    if (dataInfo?.isSymbolicLink() || (dataInfo && !dataInfo.isDirectory())) throw new Error("The database must be a directory inside its demo folder.");
    if(marker.state==='ready'&&(!dataInfo||(await readdir(dataPath)).length===0))throw new Error('The saved database is missing or incomplete. Restore a backup; existing files will not be reseeded.');
    db = await embeddedDatabase(dataPath);
    if(marker.state==='ready'){
      const [known]=await db.query<{ledger:string|null;metadata:string|null}>("SELECT to_regclass('public.schema_migrations')::text AS ledger,to_regclass('public.club_metadata')::text AS metadata");
      if(!known.ledger||!known.metadata)throw new Error('The saved database is incomplete. Restore a backup; it will not be reseeded.');
      const [existing]=await db.query<{instance_id:string;mode:string}>('SELECT instance_id,mode FROM club_metadata WHERE id=1');
      if(!existing||existing.instance_id!==marker.instanceId||existing.mode!=='demo')throw new Error('The saved database does not match this demo instance. Restore the matching backup.');
    }
    if(options.migrate!==false)await migrate(db);
    const [mode] = await db.query<{mode:string;members:number}>("SELECT mode,(SELECT count(*)::integer FROM members) AS members FROM club_metadata WHERE id=1");
    if (mode.mode !== "demo") {
      if (mode.members) throw new Error("A production database cannot be opened with the account-free demo identity picker.");
      await db.query("UPDATE club_metadata SET mode='demo',instance_id=$1 WHERE id=1",[marker.instanceId]);
    }
    if(marker.state==='initializing'){
      marker.state='ready';
      const temporary=path.join(root,'instance.ready.json');
      await writeFile(temporary,JSON.stringify(marker)+'\n',{flag:'wx',mode:0o600});
      await rename(temporary,markerFile);
    }
    let closed = false;
    const database = db;
    return { db:database, instanceId:marker.instanceId, sessionSecret:marker.sessionSecret,
      async close() { if(closed)return;closed=true;try { await database.close(); } finally { await release(); } },
    };
  } catch (error) {
    try { if(db)await db.close(); } finally { await release(); }
    throw error;
  }
}
