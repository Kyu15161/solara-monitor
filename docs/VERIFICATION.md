# Verification record

Verified locally on October 3, 2026 with native PostgreSQL 18.4, Node.js 26.7, Next.js 16.3.8, strict TypeScript and installed Chrome. The application is in mock mode. No physical inverter or private DESSMonitor account was used.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | 37 unit and mocked-transport contract tests passed |
| `npm run test:database` | 4 database integration tests passed |
| `npm run test:demo` | Three full initializations and interrupted-history recovery passed |
| `npm run build` | Production build passed |
| `npm run test:e2e` against `npm start` | Both browser journeys passed in 15.3 seconds |
| `npm audit --omit=dev` | Zero reported vulnerabilities |
| Configured secret-value scan of `.next/static` JavaScript | Passed |

The browser checks cover signup/login/logout, private demo setup, all dashboard routes, historical data, alert acknowledgement, a queued mock command through verified APPLIED state, SSE delivery, idempotency, CSRF rejection, unauthenticated denial, cross-account denial on device APIs, widget reordering, dark/light themes, and 375px mobile navigation with no horizontal overflow. Browser page errors are collected and must be empty. Desktop, mobile and dark screenshots were captured; desktop and mobile were visually inspected.

The production Secure cookie remains enabled. Chromium permits it on loopback HTTP; the separate Node API test client explicitly forwards the browser session cookie for local API assertions. Production deployment requires HTTPS.

The local database concurrency defect and preservation of existing records are documented in `LOCAL-DATABASE.md`. PGlite is no longer a dependency. Its original local data directory remains intact.

Live-provider tests use clearly isolated fixture responses to verify request signing, endpoint restrictions, malformed-data rejection, read reauthentication, flow signs, alarm disappearance semantics, unsupported controls, and non-replayed/non-verified physical commands. These tests do not establish vendor interoperability or physical application. Those checks still require an authorized staging account and inverter.

Optional integrations and product extensions that are not supplied are listed in the README. This record does not imply production load testing, a third-party security audit, external notification delivery, OAuth verification, or live hardware certification.
