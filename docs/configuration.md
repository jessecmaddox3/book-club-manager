# Configure your club

> **TL;DR:** `club.config.json` controls the name and meeting preferences. Runtime settings choose either the local example or a separately initialized shared club. Credentials belong in a private environment file, never in the JSON configuration.

The main configuration has a club name, tagline, founding year, IANA time zone, beverage label, 24-hour meeting start time, and duration in minutes. `demoDate` freezes the invented example's notion of today so its future ballot remains useful. Production ignores the demo date.

Choose your time zone before creating a hosted database. Once initialized, its stored zone and configuration must agree; `npm run setup -- status` shows the stored value. Changing a club's historical calendar policy is not an automatic configuration edit.

| Setting | Purpose |
| --- | --- |
| `BOOKCLUB_MODE` | `demo` or `production`. The desktop launcher always chooses demo. |
| `BOOKCLUB_CONFIG` | Optional path to your private club configuration JSON. |
| `BOOKCLUB_DATA_DIR` | Local demo folder; defaults to `.local/demo`. |
| `PORT` | Local server port; defaults to 5055. |
| `BOOKCLUB_ORIGIN` | Exact browser origin. Production requires HTTPS except on loopback. |
| `BOOKCLUB_BIND_ADDRESS` | Production server interface; defaults to `127.0.0.1`. |
| `DATABASE_URL` | Server-only production PostgreSQL connection; remote certificates are verified. |
| `BOOKCLUB_DATABASE_CA_CERT` | Optional private path to your database provider's certificate authority file. |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Your production Auth project URL and public key. |
| `SESSION_SECRET` | A private random string of at least 32 characters. |
| `BOOKCLUB_OWNER_MEMBER_ID` | Linked organizer UUID used by owner commands. |
| `BOOKCLUB_ENABLE_AI` | Set explicitly to `yes` to allow optional production AI calls. |
| `ANTHROPIC_API_KEY` / `BOOKCLUB_AI_MODEL` | Your optional Anthropic provider credentials and chosen model. |
| `CRON_SECRET` | Optional bearer secret for the read-only database health endpoint. |

The local demo ignores inherited database and AI credentials. It binds only to loopback and refuses cloud deployment environments. A public server must use production identities.

The optional AI tools send only the supplied book query, book titles/authors, or the explicit genre batch. They do not need member names, raw ballot responses, private notes, or email addresses. AI descriptions and bibliographic details still need checking. Genre labeling saves each completed batch before requesting the next one.

Book covers are optional local files in `public/covers/`. Those files are public static assets in a hosted installation. Use covers you have permission to redistribute; do not place personal photos, credentials, or private documents there. External cover URLs are not loaded. Without a cover, the app displays a designed text cover.
