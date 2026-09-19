# Contributing

Thanks for taking a look. Small fixes, clearer setup instructions, accessibility improvements, and well-explained new features are all welcome.

Use an invented club when developing, taking screenshots, or opening an issue. Do not commit your `.env`, `.local`, `private`, database backups, member lists, or provider credentials.

```sh
npm ci
npm run dev
npm test
npm run test:ops
npm run typecheck
npm run lint
npm run build
```

Keep command rules in the shared database functions so local and hosted behavior agree. Test observable behavior with invented records. New cloud integration should remain optional; the local demo must continue to work without external services after installation.

Once a version is published, existing migration files are immutable. Add a new migration for schema changes. Check both PGlite and real PostgreSQL for command changes. Authentication changes also need the disposable real Auth test described in [architecture](docs/architecture.md).

Explain the problem and the resulting behavior in your pull request. If you're proposing a large change, an issue describing the idea first can save work. Contributions use the project's MIT license.
