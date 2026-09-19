# A shared club with real accounts

> **TL;DR:** The shared version needs a Node server, an empty PostgreSQL database, Supabase Auth, and HTTPS. Start with the local demo first. Hosted setup is a separate installation; it never uploads or converts the invented demo into your real club.

## Prepare the services

Create a Supabase project for Auth and, if convenient, its PostgreSQL database. Use a new empty application database/public schema. Do not point the initializer at another application's database.

For the documented persistent Node server, choose a direct PostgreSQL connection or a session pooler. Setup uses a session advisory lock, and the driver uses prepared statements. Do not use a transaction pooler for this setup. Copy the actual connection details from your provider's dashboard. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

Remote database connections verify the server certificate. If your provider uses its own certificate authority, download its CA certificate through the provider's official dashboard and set `BOOKCLUB_DATABASE_CA_CERT` to the private file path. Certificate verification is not disabled by `sslmode=require`.

In Supabase Auth, create your organizer's email/password account and copy its **user UUID**. This app has no public sign-up or automatic admin assignment. Decide your password distribution/recovery process with your account provider; never put passwords in member notes or shared setup files. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## Configure this installation

1. Copy `.env.example` to `.env.local`. Replace the database connection, Auth URL, publishable key, exact public site origin, and session secret. Keep this file private.
2. Edit `club.config.json` or point `BOOKCLUB_CONFIG` to a private copy. Choose the time zone before initialization.
3. Create a `private` folder. Copy [organizer.example.json](../examples/organizer.example.json) there as `organizer.json`. Replace the invented name and example Auth UUID with your own account's exact UUID.
4. Install dependencies with `npm ci`.

To generate a random session secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Preview initialization, then apply it:

```sh
npm run setup -- init --organizer private/organizer.json
npm run setup -- init --organizer private/organizer.json --yes
npm run setup -- status
```

Initialization creates one explicitly linked organizer, an empty catalog, and the application schema. It does not create demo records. Repeating initialization refuses to overwrite the club. `setup status` recovers the generated organizer UUID if you lost the first output. Put that UUID in `BOOKCLUB_OWNER_MEMBER_ID` for owner commands.

## Start the server

```sh
npm run build
npm start
```

`npm start` reads your production environment. The desktop Start files deliberately run the local demo instead.

Place the persistent server behind HTTPS and preserve the original `Host` header. Set `BOOKCLUB_ORIGIN` to exactly the address people use, including a nonstandard port if there is one. The application rejects a different Host or browser mutation Origin. A reverse proxy on the same machine can reach the default loopback bind. A container platform may need `BOOKCLUB_BIND_ADDRESS=0.0.0.0` inside its private container network.

Use your hosting platform's normal process supervision and secret management. This repository does not create a cloud account, change DNS, provision a server, or start scheduled jobs for you. The optional [Vercel cron example](../deployment/vercel.example.json) documents the protected health endpoint only; it is not a complete Vercel deployment recipe.

## Add and link a reader

In the app, an organizer creates the member under **Admin → Members**. Separately create that person's Auth account through your provider. Then list members:

```sh
npm run setup -- members
```

Copy [link-member.example.json](../examples/link-member.example.json) to `private/link-member.json`. Enter the exact member UUID, current revision, existing Auth UUID (or `null`), and new Auth UUID. Names and emails never establish identity.

```sh
npm run setup -- link-member --plan private/link-member.json
npm run setup -- link-member --plan private/link-member.json --yes
```

Setting `authSubject` to `null` unlinks an account. The previous subject and revision must match, and the final linked organizer cannot be unlinked. Membership and role changes take effect on the next protected request. A former member can still clear their browser session by signing out.

## Upgrades and checks

Take a backup first and stop the application during an upgrade. Install the new release, then run `npm run setup -- migrate` to preview and add `--yes` to apply its ordered migrations. Startup verifies the exact migration ledger and will not silently alter a hosted database.

Optional monitoring uses `scripts/site-watch.py` with explicitly configured `BOOKCLUB_ORIGIN`, `BOOKCLUB_NAME`, and `CRON_SECRET`. `BOOKCLUB_REDIRECT_ORIGIN`, `BOOKCLUB_HEARTBEAT_URL`, and `BOOKCLUB_WATCH_DIRECTORY` are optional. The monitor sends a heartbeat only after all configured checks succeed. No monitor is installed or scheduled automatically.
