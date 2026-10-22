# Database architecture

Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations`. Seed: `prisma/seed.ts`.

## Conventions

- `cuid` string ids.
- Tenant-owned rows carry `schoolId` (and `organizationId` where the record spans schools, such as guardians).
- Money is integer **paise** (`Int`). No floats anywhere in the money path. ₹2.1 crore per invoice is the `Int` ceiling, far beyond school fees.
- School dates (attendance, due dates) are `@db.Date` values representing the IST calendar date.
- Posted financial rows (payments, journal entries) are never updated in amount or deleted. Corrections are reversals.

## Main entities

| Area | Tables |
| --- | --- |
| Hierarchy | Organization, School, Campus |
| Identity | user, session, account, verification, twoFactor, rateLimit (Better Auth), Invitation |
| Access | Permission, Role, RolePermission(scope), UserSchoolMembership, UserRoleAssignment, TeacherAssignment |
| Academics | AcademicYear, Grade, Section, Subject |
| Students | Student, StudentStatusHistory, StudentEnrollment (unique per student per year), Guardian (unique per org+phone), FamilyAccount, FamilyMembership, StudentGuardianRelationship |
| Attendance | AttendanceSession (unique section+date+period), StudentAttendance, AttendanceCorrectionRequest |
| Fees | FeeCategory, FeeStructure, FeeComponent, StudentFeeAssignment, Invoice, InvoiceLineItem, Payment, PaymentAllocation, Receipt |
| Finance | LedgerAccount (with Tally ledger mapping), JournalEntry, JournalLine, DocumentSequence |
| Platform | AuditLog, Notification, DevOutboxMessage |

## Integrity rules enforced in the database

- Unique admission number per school; unique invoice, receipt and journal numbers per school.
- One enrollment per student per academic year; one attendance mark per student per session.
- One fee-structure assignment per student per structure; payments have a unique idempotency key.
- A journal entry can be reversed at most once (`reversesId` unique).

## Concurrency

- Payment recording locks the student's open invoices (`SELECT … FOR UPDATE`) inside the transaction, so two cashiers cannot over-allocate the same balance (covered by an integration test).
- Approvals and reversals use conditional updates (`WHERE status = 'PENDING'` / `'RECORDED'`) so a double click cannot apply twice.
- Document numbers come from `DocumentSequence` rows updated inside the same transaction.

## Accounting postings

| Event | Debit | Credit |
| --- | --- | --- |
| Invoice issued | 1100 Fees Receivable | 4000 Fee Income |
| Payment recorded | 1000 Cash / 1010 UPI Clearing / 1020 Bank / 1030 Cheques | 1100 Fees Receivable |
| Payment reversed | 1100 Fees Receivable | the original mode account |

Tally remains the system of record for accounting. `LedgerAccount.tallyLedgerName` holds the mapping for the planned export.
