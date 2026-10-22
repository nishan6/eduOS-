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

### D13. One grading scale for now: CBSE nine-point
Report cards use A1 (91–100) down to E (below 33), pass mark 33% per subject, percentages rounded up to a whole number before grading (90.5 → A1). Both pilot boards report on this shape. A per-school grading configuration (AP state-board term weights, CCE, co-scholastic areas) is deferred until a school needs a different scale; `src/modules/exams/calc.ts` is the single place to change. Absent counts as zero toward the total and fails that subject; a missing mark marks the report card incomplete rather than guessing.

### D14. Exam papers per section and subject; marks locked on submit and on publish
Creating an exam generates one paper for every current section of the chosen classes × each subject, so teachers see exactly the papers for their sections. A submitted paper is read-only until a principal reopens it with a reason (audited). Publishing requires every paper submitted and locks all marks; parents only ever see published exams. Marks are `Decimal(5,1)` (half marks allowed). Results follow the student's current section; a mid-year section change is not yet reflected in older exams.

### D15. Admission happens only through conversion
An enquiry cannot be moved to ADMITTED by a stage change. "Admit student" calls the normal `createStudent` service and marks the enquiry admitted inside the same transaction, so a failure leaves neither a stray student nor a half-admitted enquiry. Front office can log and progress enquiries but cannot admit (no `students.create`).

### D16. Announcements are in-app first; email after commit
Sending creates the announcement and in-app notifications in one transaction, then hands emails to the email adapter. With no provider configured they land in the development outbox and the sender is told none were delivered. Large sends will need a background queue before production use (marked TODO in the service).

### D17. Role templates are re-synced by a script, not a migration
New permissions ship in `catalog.ts`. After deploying, run `npm run db:sync-roles` to update system roles in every organization. Custom roles are untouched.

### D18. Grading scale per school, copied onto each exam
Schools choose a scale in School setup: CBSE nine-point (pass 33%) or the AP state-board nine-point scale (A1 92–100, A2 83–91, B1 75–82, B2 67–74, C1 59–66, C2 51–58, D1 43–50, D2 35–42, E below 35; pass 35%). State-board schools default to the AP scale. **The AP bands are the commonly published SSC scale and must be confirmed with the pilot school before report cards go out.** Each exam copies the scale and pass mark when it is created, so changing the setting never rewrites results already published. Adding a scale is one entry in `SCALES` plus an enum value.

### D19. Timetable is a grid of section × weekday × period
Periods (`PeriodSlot`) are shared by every class in a school; breaks are periods flagged `isBreak`. Each cell holds a subject and optionally a teacher. A unique index on (teacher, weekday, period) makes double-booking impossible even under concurrent edits; the service checks first so the error names the clashing class. Monday–Saturday only. Rotating or multi-week timetables are out of scope for now.

### D20. Helpdesk: raisers see their thread, staff see the queue
Parents raise requests about a specific linked child (the school is taken from the child); staff raise them in their own school. Staff with `tickets.manage` work the school queue, can add internal notes, assign and change status. The raiser's view never loads internal notes. A raiser replying to a resolved ticket reopens it; closed tickets accept no replies.
