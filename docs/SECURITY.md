# Security model

## Accounts and sessions

Passwords are salted and hashed with Node scrypt. Sessions use 256-bit random opaque tokens; PostgreSQL stores SHA-256 token hashes rather than browser token values. Session cookies are HttpOnly, SameSite=Lax, expire after seven days and are Secure in production. Every private route checks the session and database ownership. No role or ownership supplied by the browser is trusted.

Mutations require the configured `APP_URL` Origin and JSON content. Body size is bounded. Login throttling is stored in PostgreSQL by normalized email hash; a global auth limit does not rely on attacker-controlled forwarding headers. Other sensitive actions have per-user/integration limits. A production reverse proxy should additionally limit requests by a trusted connection IP and cap active SSE connections.

Password-reset tokens are hashed, short lived and consumed transactionally. Password reset invalidates every existing session. Delivery is explicitly unavailable until a real mail adapter is configured. No known development password is created in production or in anonymous demo mode.

## DESSMonitor secrets

Credential JSON is encrypted with AES-256-GCM, a unique nonce per encryption and a server-only 32-byte encryption key. Authentication tags are verified during decryption. Signing, HTTP calls, database access and credential code are server-only modules. DTOs deliberately select public fields. No password, encrypted credential, token or signing secret is included in dashboard JSON or account exports.

Preserve the encryption key separately from database backups. A lost key makes existing integrations unreadable and requires reconnecting. Rotation requires decrypting with the old key and re-encrypting with the new key in a controlled migration. Never overwrite the key without a migration plan.

Only the configured official HTTPS DESSMonitor endpoint is permitted. Redirects and insecure fallback are blocked. Logs record operation categories and local IDs, never query strings or upstream payloads containing authentication data.

## Control boundary

Viewer roles are read-only. Owners/Admins may change supported low-impact settings; high-impact settings require owner access and Safe Control Mode off. UI hiding is not the enforcement mechanism. Server validation checks discovered metadata, option/range constraints, current value, ownership, integration connection, role, and explicit confirmation again when the worker runs.

Commands receive globally unique idempotency keys, a durable queue record and an audit entry in one transaction. Execution uses compare-and-set claims. A worker interrupted after submission leaves UNKNOWN, without automatic replay. Requests are never optimistically labeled Applied. The mock provider verifies its own persisted state. Live response acceptance does not prove physical application.

## Stored data and exports

Device reading uniqueness is `(deviceId, deviceTimestamp)`. History is never deleted by ordinary synchronization. Aggregates have independent keys including timezone. Suspect readings and large gaps are excluded from energy integration. Acknowledging an alert never sets its resolution time.

CSV text cells neutralize formula prefixes. Exports enforce tenant ownership and bounded ranges. Account deletion requires an exact confirmation and, for registered users, the current password. Cascades affect this application's records only; no upstream account deletion occurs.

The service worker caches only the public offline shell and icon. Authenticated pages, API responses and credentials are not put in browser caches. Content security policy, frame denial, nosniff, referrer and permissions headers are set centrally.

## Operations

Use standard PostgreSQL, HTTPS, least-privilege database credentials, encrypted backups, a secret manager, and supervised workers in production. The bundled native PostgreSQL launcher is loopback-only development infrastructure; production requires a separately managed database service. Keep dependencies patched; pinned overrides address transitive advisories detected during implementation.

Monitor sync failures, a growing command queue, worker restarts, authentication throttles and database health. The sync lease is bounded; keep provider operations shorter than the lease and use one worker until multi-instance load testing is complete. The SSE implementation polls database revisions and needs connection limits and scale testing before a large rollout.

For suspected compromise: stop physical writes, revoke local sessions, disconnect affected integrations, rotate vendor credentials and encryption keys as appropriate, preserve audit records, and investigate without logging secrets. Production security certification and hardware validation are outside what can be established from a local mock test run.
