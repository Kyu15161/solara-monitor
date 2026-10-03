# Solara Energy Monitor

A working solar-inverter dashboard built from the supplied master specification. The default installation uses an explicitly labeled, private simulated inverter. Monitoring, account registration, historical analysis, notifications, controls and audit records use a persistent database.

## Run locally

Requirements: Node.js 22.12+ (verified here with Node 26.7), npm, and three terminal sessions. No DESSMonitor account, Docker, or physical inverter is required for the demo.

```powershell
npm ci
npm run setup
npm run db:generate
```

`setup` creates `.env` with a unique random encryption key. It preserves an existing `.env`. Never commit that file.

Terminal 1:

```powershell
npm run db:local
```

Terminal 2:

```powershell
npm run db:migrate
npm run worker
```

Terminal 3:

```powershell
npm run dev
```

Open **http://127.0.0.1:3000**, then choose **Explore demo system**. Initial setup generates 90 days of persistent history and normally takes a few seconds. Each anonymous demo receives its own isolated account, inverter, alerts and command state. There is no shared demo password. Alternatively, register an account and choose **Try demo system**.

Use the same hostname as `APP_URL`; mutation requests deliberately reject a different Origin. If port 3000 is occupied, configure both the launch port and `APP_URL` consistently.

The local launcher runs native PostgreSQL 18 from project-local binaries, binds to loopback, and persists in `.data/native-postgres`. It does not install a system service. The default port is 5434. Use Ctrl+C to stop it cleanly. Existing clusters are reused. On Linux/macOS, ensure the platform package's installation scripts are approved so its required binary symlinks exist. Use a managed PostgreSQL service for production.

## Standard PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string. The included Docker Compose file starts PostgreSQL 17 when Docker is available. Set `POSTGRES_PASSWORD` before running it; there is no production default password. Run `npm run db:migrate` against the selected database.

## Implemented application

- Next.js App Router, React, strict TypeScript, Tailwind, accessible Radix/shadcn-style Button and Dialog primitives, Lucide and Recharts.
- Email/password registration and login, scrypt password hashes, hashed opaque sessions, HttpOnly cookies, logout, profile changes and confirmed application-account deletion.
- Plant → collector → device discovery and a server-side provider contract shared by mock and live integrations.
- Responsive dashboard, dark/light themes, energy-flow links and animations, solar/battery/grid/inverter details, dynamic protocol fields and raw parameter inspection.
- Database-first monitoring, configurable worker synchronization, SSE invalidation, separate device/receipt/processing timestamps, and stale/offline states.
- Ninety days of 15-minute demo samples, hourly/daily/monthly aggregates, timezone-aware day boundaries, gap-aware energy integration, charts, period comparisons, heatmap, history filters and CSV/JSON export.
- Persistent alerts with independent acknowledgement/resolution, notification center, and command activity logs.
- Dynamic controls, server-side roles and ownership checks, safe mode, confirmation, idempotency, queued execution and separate simulated read-back verification.
- Development scenarios for clouds, night, low battery, grid failure, offline reporting, high temperature and communication failure.
- User-configured tariff estimates, overview widget preferences, local device alias, integration disconnect/reconnect and account export.
- PWA manifest, SVG icon and a public offline shell. The app never caches authenticated pages or credentials in the service worker.

## Architecture

```text
Mock / DESSMonitor provider
        ↓
Validation and conservative normalization
        ↓
Background worker → PostgreSQL/Prisma → aggregation and alerts
        ↓                                    ↓
Authenticated application API ← database-backed command queue
        ↓
SSE change notifications → reusable dashboard views
```

Browsers never call DESSMonitor. SSE connections read only our database and do not trigger provider polls. A conditional database lease prevents ordinary concurrent sync workers from polling the same integration. Production workers should run as supervised long-lived Node processes. Use a reverse proxy configured for streaming SSE without buffering.

The worker scans for due integrations every two seconds; the provider polling interval defaults to 120 seconds. Manual sync queues a request and is throttled to once per 30 seconds. Failed syncs retain cached data and back off from 30 seconds up to 15 minutes. A worker must be running for scheduled updates and queued commands to progress.

## Live DESSMonitor

See [docs/DESSMONITOR.md](docs/DESSMONITOR.md) before enabling live mode. No live account or hardware was supplied, so network interoperability and physical command behavior are **not hardware-verified**.

Set `DESSMONITOR_MODE=live`, a server-side `DESSMONITOR_APP_ID`, and the official HTTPS base URL. Enter account credentials through the authenticated connection form. Discovery must finish successfully before the encrypted connection is saved. The provider uses only documented actions; unsupported or ambiguous values remain unavailable.

All physical controls are disabled unless their actual discovered IDs are explicitly reviewed and configured in `DESSMONITOR_ALLOWED_CONTROL_IDS`. Only documented enumerations with a readable current value can be enabled. Owners must also disable Safe Control Mode and give a second confirmation. A live command is never labeled Applied solely because DESSMonitor accepted it.

## Environment

See `.env.example` for defaults.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only PostgreSQL connection |
| `APP_URL` | Canonical origin, used for CSRF protection and reset links |
| `ENCRYPTION_KEY` | 32 random bytes encoded as 64 hex characters; AES-256-GCM at-rest key |
| `DESSMONITOR_MODE` | `mock` by default; gates accepting live credentials |
| `DESSMONITOR_BASE_URL` | Only `https://api.dessmonitor.com/public/` is allowed |
| `DESSMONITOR_APP_ID` | Your operator-configured app identity |
| `DESSMONITOR_APP_VERSION` | Application version used in signed calls |
| `DESSMONITOR_DEFAULT_SOURCE` | Platform source; defaults to energy storage (`1`) |
| `DESSMONITOR_SYNC_INTERVAL_SECONDS` | Polling interval; default 120, minimum 10 |
| `FRESHNESS_DELAYED_SECONDS` | Delayed threshold; default 300 |
| `FRESHNESS_OFFLINE_SECONDS` | Offline threshold; default 900 |
| `ENABLE_DEMO` | Explicitly allow anonymous private demo creation |
| `MAIL_WEBHOOK_URL`, `MAIL_WEBHOOK_SECRET` | Optional password-reset delivery adapter |

No `AUTH_SECRET` is needed: session cookies contain cryptographically random opaque tokens, whose hashes and expiry are stored in PostgreSQL. They are not unsigned user claims or frontend JWTs.

Password-reset requests return a clear unavailable error when mail delivery is not configured. The optional HTTPS webhook receives `{to, subject, text}` with a Bearer secret, and must actually deliver the message. No email service is faked. Reset tokens are single use, expire after 30 minutes, and revoke existing sessions.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:database
npm run test:demo
npm run build
```

Browser tests expect the database, app and worker to be running. They use installed Chrome by default. Set the Playwright channel appropriately on machines without Chrome, or install Playwright Chromium and remove the channel setting. Test fixtures use only `example.local` emails and mock devices. Screenshots are saved under `.data/`.

Unit tests exercise energy balance, gap/duplicate/missing-data integration, sign changes, timezone/DST boundaries, control permissions and validation, freshness, password hashing, encryption authentication, official signature arithmetic and conservative normalization.

## Production

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
# Run independently under a process supervisor:
npm run worker
```

Use managed PostgreSQL, HTTPS, a secret manager, encrypted backups, an explicit demo-access policy, reverse-proxy request limits and supervised worker health checks. `Secure` session cookies are enabled in production. Do not run `db:local` in production. Application logs intentionally omit credentials and signed URLs.

## Scope and known limits

This is a functional application, with a complete mock monitoring/control path. It is not a claim that every optional extension in the 133-section master specification is production-certified.

- Live integration needs validation with the intended vendor account, company key and protocol before operational use. The official documentation contains inconsistent sample hashes and some broken navigation links; the verified contracts and discrepancies are recorded separately.
- Generic normalization is intentionally conservative. Signed battery/grid readings, energy counters and protocol-specific meanings must not be guessed from arbitrary labels. Unknown parameters stay visible; unavailable headline metrics stay empty.
- No OAuth, email verification service, external notification services, weather provider, custom threshold builder, production retention deletion, or collaborative invitation/role-management UI is supplied. Owner/Admin/Viewer enforcement exists in the backend; an operator can provision restricted roles through the database.
- The offline PWA shell does not retain private telemetry across closed sessions. An already-open disconnected dashboard displays its last known values with a disconnected indicator.
- Raw requests are limited to 20,000 readings. Historical date ranges are bounded to ten years; imports should be performed in bounded batches. No automatic history deletion is enabled.
- Initial timezone rebucketing is computed from stored samples and cached. Reporting availability means observed sample coverage, not a claim that an inverter was physically operating during every covered second.
- Local PostgreSQL uses development-only connection credentials from `.env`. Production needs a separate database, restricted database user, backups and service supervision.

See [docs/SECURITY.md](docs/SECURITY.md) for security and operating considerations.
