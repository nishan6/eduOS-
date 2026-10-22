# Implementation roadmap

Legend: ✅ done and tested · 🟡 partial · ⬜ not started

## Milestone A — Foundation ✅
- ✅ Next.js app, TypeScript strict, Tailwind design tokens, responsive shell (sidebar, mobile drawer, school selector, search, notifications)
- ✅ PostgreSQL + Prisma migrations, reproducible non-destructive seed
- ✅ Better Auth sessions, login/logout, password reset (email via adapter), invitation activation, no public sign-up, sign-in rate limiting, suspended-account block, session revocation on suspension and password reset
- ✅ Organization → school hierarchy, role templates, scoped permissions, audit log
- 🟡 MFA: plugin and tables installed; enrollment/verification screens pending

## Milestone B — First complete workflow ✅
- ✅ Create student, link guardian (dedupe by phone), enroll in year/class/section, move sections
- ✅ Invite guardian → activate → parent sees linked children across schools
- ✅ Teacher marks/saves/submits attendance for assigned sections; corrections with principal approval
- ✅ Parent sees attendance; in-app absence notifications
- ✅ Cross-school, cross-family and unassigned-section access rejected (tests)

## Milestone C — Financial workflow ✅
- ✅ Fee categories and structures with installments
- ✅ Assign structure → one invoice per due date, posted to ledger
- ✅ Record cash/UPI/bank/cheque payment, oldest-first allocation, receipt, idempotency, concurrency lock
- ✅ Outstanding, overdue, aging, collections by mode; parent fee view
- ✅ Reversal with mirror journal entry; manual journals restricted to finance roles and owners
- 🟡 Reconciliation: "mark verified" per payment; bank statement import pending
- ⬜ Concessions/discounts with approval, refunds, credit notes, advance payments

## Milestone D — Academic and operational expansion 🟡 (core shipped)
Done:
- Homework: teachers set and cancel homework for their sections; parents see it on the child page and get a notification.
- Exams: principal creates an exam (papers per section × subject), teachers enter and submit marks with validation, principal reopens with a reason, publishes when all papers are in. Report cards for staff and parents (published only), printable.
- Admissions: enquiry pipeline (New → Contacted → Visit → Applied → Offered → Admitted/Lost), follow-up dates, activity log, duplicate detection, one-step conversion into an enrolled student with guardian.
- Notices: send to all parents, one class or one section (teachers: own sections only); in-app plus email adapter; parent notices page.

Remaining: per-board grading configuration and co-scholastic areas, timetable, events calendar, generic approvals engine, helpdesk tickets, parent-teacher messaging.

## Milestone E — Specialist modules ⬜
Transport, hostel, HR (staff attendance, leave), Tally export, payment gateway, SMS/WhatsApp adapters, biometric adapter.

## Milestone F — AI OS ⬜
Grounded parent summaries, teacher drafting tools, principal briefing, owner intelligence, approved AI actions. Will only use permission-checked service calls.

## Milestone G — Pilot readiness ⬜
ScientificStudy CSV import with preview/dedupe/exception report, security review, load testing, backup drills, onboarding docs, school acceptance testing.

## Next steps (recommended order)
1. Connect GitHub CI and a staging deployment with managed Postgres.
2. CSV import for students and guardians (needed before any real pilot data).
3. Concessions/discount approvals.
4. MFA screens for owners and finance staff.
