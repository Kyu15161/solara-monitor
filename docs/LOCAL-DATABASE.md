# Local database verification

The initial local PGlite socket service failed during concurrent web and worker queries. The captured PostgreSQL error was `08P01`: an unnamed prepared statement expected one parameter while an interleaved batch supplied 4,800. This matches the upstream [multiplexer defect](https://github.com/electric-sql/pglite/issues/1046). Reducing test coverage or retrying arbitrary writes would not address the cause.

The development launcher now starts native PostgreSQL 18.4 through the platform binaries installed by [embedded-postgres](https://github.com/leinelissen/embedded-postgres). Application Prisma configuration and production database semantics remain PostgreSQL. Runtime binaries and data stay within the project directory. No operating-system service or user is installed.

The previous `.data/postgres` directory is preserved as a local recovery copy. All application records were transferred transactionally to `.data/native-postgres`; the source was only read. The one-time `scripts/migrate-local-data.ts` helper requires distinct loopback URLs and an empty destination, and rolls back if copying fails. Do not use it as a general production migration tool.

`npm run test:demo` exercises complete seeding repeatedly and simulates an interrupted setup by removing one reading and marking the test device importing. Setup must restore the reading, mark the history complete, and avoid duplicate seeded events. Test accounts are removed afterward. `npm run test:database` verifies alert resolution semantics, held sync leases, and cached telemetry during offline/failure scenarios. Both suites require a running local database with migrations applied.
