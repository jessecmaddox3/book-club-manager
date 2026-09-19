# Book Club Manager

Read README.md and docs/architecture.md before making changes. This repository contains the reusable public application, not anyone's private club records.

- Keep demo records wholly invented. Never commit environments, personal exports, member lists, backups, calendar files, message drafts, or deployment credentials.
- Preserve the same command behavior in PGlite and PostgreSQL. Test observable behavior, stale revisions, and permission boundaries for changes to voting or identity.
- Do not edit a migration that has shipped. Add a new migration and test upgrades. Do not automatically migrate a hosted database on server startup.
- Keep the local demo account-free and loopback-only. Never make its reader picker a hosted login mechanism.
- AI is optional. Tests and demos must not make paid provider calls. Communication tools produce drafts, never send automatically.
- Use UUIDs for identity. Names and titles may collide.
- Verify with npm test, npm run test:ops, npm run typecheck, npm run lint, and npm run build. The integration workflow exercises disposable real PostgreSQL and Supabase Auth installations.
- Keep beginner instructions accurate. Use invented screenshots and preserve third-party license notices.
