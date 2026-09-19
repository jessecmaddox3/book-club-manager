# Your data and the public project

> **TL;DR:** The repository includes software, documentation, licensed assets, and invented examples. Your real club's identities, opinions, messages, credentials, and backups belong in your private installation.

## What ships

Lantern Reading Room is an entirely invented example. Its people, books, dates, ratings, goals, and predictions were written for the public demo. The release was extracted into a new repository without private Git history, databases, environments, account configuration, original club media, or message archives.

The public design reflects a system built for personal use. That includes book preferences, beverage volunteers, organizer routines, reading history, and forecasting ideas. Those features do not describe the original club's membership or records.

## What stays on your computer

The local demo stores records in `.local/demo` by default. It needs internet access for the initial dependency installation. Ordinary demo use has no external fonts, analytics, AI requests, cover lookup, or account service. Its reader picker deliberately permits exploring every invented role; it is not a private multi-user login system.

Backups, saved plans, drafts, calendars, and recipient lists can contain personal information after you customize the installation. Store them privately. The standard `.gitignore` excludes `.local/`, `private/`, `.env` files, generated build output, and deployment credentials. Ignore rules cannot protect a file placed elsewhere or deliberately force-added.

## What a hosted club shares

Your server talks to the configured database and identity provider. Database and provider secrets remain server-side. Browser sign-in sessions use HttpOnly cookies checked against the configured identity provider. Members can see the club information described by the UI; organizers can inspect individual ballot responses, contact information, and private nomination worksheets. Use a club with expectations appropriate to that visibility.

Book covers placed in `public/covers/` are static public assets, even if club pages require login. Include only images you have rights to share publicly. Do not put personal photos, private documents, secrets, or guest lists anywhere under `public/`.

Optional AI sends the inputs needed by the chosen feature to your configured provider. Book searching sends your search text and the titles/authors already read so it can avoid duplicates; recommendations send the requested preferences and catalog context; genre labeling sends book titles and authors. Do not enter private text in these optional fields unless you intend to share it with that provider. The software does not purchase a subscription or send a request merely because an API key exists.

## Before sharing a change

Use invented fixtures and screenshots. Inspect file names, image metadata, embedded URLs, generated artifacts, and the exact Git diff. Never attach a real backup or `.env` to an issue. Use the reporting route in [SECURITY.md](../SECURITY.md) for a vulnerability and describe it with synthetic data.
