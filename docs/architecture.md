# How the club fits together

> **TL;DR:** One Next.js app serves the member and organizer screens. Both local and hosted installations use the same PostgreSQL schema and command functions. Personal records belong in your own database, never in the public source tree.

## Two ways to run it

The local demo uses PGlite, PostgreSQL compiled to WebAssembly, with an exclusive data-folder lock and an invented starter club. Its reader picker is a demonstration tool, not authentication. The server binds to a loopback address and refuses known cloud deployment environments.

A shared installation uses a server-only PostgreSQL connection and Supabase Auth. A provider-verified Auth subject must be explicitly linked to a current club member. The database supplies the current role on each request; profile metadata never grants organizer access. Browser database roles have no access to the application tables or command functions. Hosted startup checks the migration ledger; only an owner setup command applies migrations.

## A meeting's life

A suggestion is private to its proposer and organizer tools. An organizer builds a draft with explicit books, recommenders, and possible dates. Opening it makes the ballot available. Members rate each book, answer availability, and can volunteer to host or bring drinks. A newer draft does not hide an existing open ballot.

Finalization requires a reviewed book, date, and optional host/volunteer selection. Voting and finalization acquire the same database lock. A vote accepted after the organizer's preview invalidates that preview. Successful commands retain an operation receipt so an exact retry does not repeat the work. Reopening is limited to a future, unread meeting; old forms become stale.

Post-read verdicts are distinct from pre-read preferences. Verdict changes use revision checks, including clearing a verdict. Names and titles are display labels; joins and ownership use UUIDs. A tab tied to a different reader cannot submit after another tab switches the session's identity.

## Reading and forecasting

Typed read repositories supply the history, also-rans, members, meetings, ratings backlog, charts, organizer matrix, goals, and annual predictions. They omit nominee attribution from ordinary open-ballot views and enforce results access at the database read boundary.

The preference predictor retains six additive configurations using member baselines, genre, recommender, and pooled self-nomination effects. It uses finalized earlier preference votes, deduplicates by UUID, tunes on earlier chronological folds, and reports later evaluation separately. It records the complete input snapshot with each saved run. Small samples can produce unavailable metrics; these estimates are exploratory.

## Files worth opening

| Location | Responsibility |
| --- | --- |
| `src/app/` | Member and organizer pages and HTTP routes. |
| `src/lib/store/reads.ts` | Typed, permission-aware page data. |
| `db/migrations/` | Schema, atomic command functions, and migrations. |
| `src/lib/auth/` | Verified hosted identity and local demo sessions. |
| `src/lib/ballots/` | Validation, previews, and ballot commands. |
| `src/lib/predict/` | Preference model, exact-input persistence, genre proposals. |
| `src/lib/operations/` | Private message drafts and calendar export. |
| `scripts/` | Launch, owner commands, monitoring, and integration checks. |
| `skills/book-club-operations/` | Portable assistant instructions for the monthly routine. |

## Current boundaries

Annual goals and New Year's predictions have viewing/reporting pages, not dedicated authoring screens. Owner tooling handles ballot transitions, forecasts, and account linking. There is no generic importer for someone else's old database. This release starts a hosted club empty rather than guessing how private legacy records should map.

Drafts do not send email. Calendar files do not issue invitations. The monitor calls only explicitly configured endpoints. AI is optional, disabled in the demo, and requires an explicit provider configuration in production. No paid-provider behavior is required by the normal checks.

The supported deployment is a persistent Node.js process behind HTTPS with PostgreSQL and Auth. The sample cron configuration is not a complete serverless deployment. Large organizations, multiple clubs in one database, and live collaborative editing are outside this release's tested scope.
