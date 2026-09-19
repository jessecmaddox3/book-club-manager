# Backup, restore, and a fresh example

> **TL;DR:** Stop the local app before a backup. Restore into a new folder. Your original folder is retained. Treat every backup as private, because it contains the records you entered.

## Local demo

Create a `private` folder inside the project if it does not already exist. In the project terminal:

```sh
npm run storage -- backup --file private/club-backup.json
npm run storage -- restore --file private/club-backup.json --destination .local/restored-club
```

The backup command reserves a new output file, locks the existing store, and saves a native PGlite snapshot without applying database migrations. It never replaces an existing backup. A failed write can leave an incomplete new file; keep your last successful backup and choose a new filename when retrying.

Restore accepts your own backup files up to 256 MB. It checks the archive digest, refuses every existing destination folder, and verifies the application schema. A damaged or incompatible restore never replaces your working folder. An incomplete new destination remains marked as incomplete and will not be silently reseeded.

A restored copy receives a fresh instance ID, session secret, and session generation. Old browser cookies and saved close plans do not apply to it. The backup does not contain the old session secret. It does contain club records, and should not be uploaded to GitHub or attached to public issues.

Use the directory and configuration paths printed by restore. For example, in a Mac/Linux terminal:

```sh
BOOKCLUB_DATA_DIR=.local/restored-club BOOKCLUB_CONFIG=.local/restored-club/club.config.json npm run demo
```

In Windows PowerShell:

```powershell
$env:BOOKCLUB_DATA_DIR='.local/restored-club'
$env:BOOKCLUB_CONFIG='.local/restored-club/club.config.json'
npm run demo
```

Older backups require their matching application release for restore. Once restored successfully, take another backup before applying a later release's migrations. The backup format is not a cloud import format and does not include environment secrets or custom files in `public/covers`.

For a fresh invented example, choose a new `BOOKCLUB_DATA_DIR` and start the demo. Keep the old folder until you no longer need it. There is intentionally no command that deletes an arbitrary data directory.

## Hosted PostgreSQL

Use your provider's backup service or PostgreSQL's `pg_dump` and `pg_restore`, with a direct connection and a private destination. Test restoration to a separate database before depending on the backup. Application rows and Auth accounts live in separate schemas or services; preserve the provider's identity backup/recovery plan as well as the club data.

An application-only dump of `public` preserves member Auth UUID links but does not create the matching Auth users in a different project. Do not assume that importing club records alone transfers passwords or identities. Keep your environment configuration and any private CA certificate separately.

See the provider's [connection guidance for backup tools](https://supabase.com/docs/guides/database/connecting-to-postgres) and PostgreSQL's [pg_dump documentation](https://www.postgresql.org/docs/17/app-pgdump.html).
