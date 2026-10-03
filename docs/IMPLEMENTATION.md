# Implementation plan

The repository initially contained only `implementation plan.md`, the supplied master specification. No existing application or repository rules were found.

1. Foundation: Next.js App Router, strict TypeScript, Tailwind and accessible shadcn-style primitives; PostgreSQL/Prisma; database-backed opaque sessions and scrypt passwords. Establish tenant ownership and an interchangeable server-only provider contract. Run a local PostgreSQL-compatible development instance if system PostgreSQL is unavailable.
2. Monitoring: deterministic, physically balanced mock inverter; persistent discovery and telemetry; one database-coordinated sync worker; SSE reads our database; responsive dashboard, parameter pages, freshness and simulation scenarios.
3. History: seed 90 days of simulated readings, gap-aware energy integration, stored aggregates, range comparisons, heatmap, history and authenticated CSV/JSON export.
4. Alerts: persistent active/resolved lifecycle, separate acknowledgement, notifications and event history.
5. Controls: dynamic metadata, role checks, safe mode, explicit confirmation, idempotent submissions, worker execution and read-back verification, durable audit trail.
6. Live: inspect official DESSMonitor documentation, record exact verified contracts and implement only documented operations. Unknown protocol mappings remain unavailable rather than being guessed. Credentials are encrypted and never serialized to clients.
7. Hardening: meaningful unit/integration/browser checks, migrations, production build, responsive checks, PWA shell and operational/security documentation.

The application remains runnable between phases. The demo is explicitly simulated. Live hardware verification requires an actual authorized account and hardware; no such credentials were supplied.
