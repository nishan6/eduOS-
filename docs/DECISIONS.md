# Architecture decision record

### D1. Modular monolith on Next.js + PostgreSQL
One deployable, one database, domain modules under `src/modules`. Microservices would add operational cost with no benefit at pilot scale.

### D2. Better Auth for authentication
Maintained, database-backed sessions (revocable), built-in rate limiting, two-factor plugin, Prisma adapter. Public sign-up is disabled; accounts come from invitations or seeding. Pinned to 1.3.x.

### D3. Prisma 6 (not 7/8)
Prisma 7+ requires driver adapters and a new generator; 6.19 is stable and well understood. Revisit after the pilot.

### D4. Permissions are data with scopes
Permission keys + scope per role, evaluated by a pure function. Teachers' access is driven by `TeacherAssignment`, parents' by explicit guardian links. Lets schools configure access without code changes.

### D5. Out-of-scope records return Not found
Avoids confirming that another school's or family's record exists.

### D6. Integer paise, server-side arithmetic, reversals not edits
All money in `Int` paise; allocation and status logic live in `fees/calc.ts` and are unit tested. Posted payments and journal entries are never edited or deleted.

### D7. EduOS keeps an operational ledger; Tally stays the accounting system of record
Invoices and receipts post double-entry journals so balances reconcile, with a Tally ledger-name mapping per account for a reviewable export later.

### D8. Recording a UPI payment does not mean it is verified
Payments carry `verification = UNVERIFIED` until finance marks them verified against bank records or a gateway webhook confirms them.

### D9. Tests use a throwaway database per run
The test harness creates `<TEST_DATABASE_URL>_<timestamp>`, migrates and seeds it, and drops only that database. It never resets an existing database.

### D10. No route-level `loading.tsx` under `/app` (for now)
With Next.js 15.5, a `loading.tsx` boundary under `/app` intermittently left client navigations after server actions stuck (about one in four in automated runs; server responses were complete). Removing it fixed the stall; pages render in roughly 100–250 ms. Re-introduce per-section `<Suspense>` boundaries after upgrading Next.js and re-running the e2e suite several times.

### D11. School dates are IST calendar dates
Attendance and due dates use `@db.Date` holding the Asia/Kolkata date, computed by `schoolToday()`.

### D12. Development email outbox
Without `EMAIL_PROVIDER`, emails are stored in `DevOutboxMessage` and shown at `/app/settings/outbox` (disabled in production). Nothing pretends to be delivered.
