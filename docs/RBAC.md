# Roles and permissions

Source of truth: `src/lib/permissions/catalog.ts` (catalog and templates) and `src/lib/permissions/evaluate.ts` (pure evaluation, unit tested).

## Model

- **Permission**: an explicit action key, e.g. `attendance.mark`, `fees.collect`, `finance.ledger.create`.
- **Scope** attached to each permission in a role: `ORGANIZATION`, `SCHOOL`, `ASSIGNED` (only sections in `TeacherAssignment`), `OWN_FAMILY` (only linked children), `SELF`.
- **Role**: a named set of (permission, scope). EduOS templates are copied into each organization (`syncRoleTemplates`); organizations can add custom roles with the same keys, without code changes.
- **Assignment**: user + role + organization + optional school. No school = organization-wide.

A user can hold several roles in different schools; grants are evaluated per school.

## Evaluation

`can(actor, permission, { schoolId, sectionId? })` is true when the actor has the permission in that school (org-wide or school assignment) with `ORGANIZATION`/`SCHOOL` scope, or with `ASSIGNED` scope and the section is one of theirs. Family permissions are checked with `hasFamilyPermission` plus a database link check (`isLinkedGuardian`). Every protected read, write and action calls these on the server.

## Templates (summary)

| Role | Level | Highlights |
| --- | --- | --- |
| Organization owner | Org | Everything operational, ledger create/update, reconcile, approvals |
| Group administrator | Org | Students, users, settings, reports; **no** ledger writes or fee collection |
| Principal | School | Students, attendance including corrections, read fees, discount approval, exams (create, reopen, publish), homework, admissions, notices; **no** ledger writes |
| Vice principal | School | Attendance corrections, exams, homework, notices |
| Teacher | School | `students.read`, `attendance.read/mark`, `homework.read/manage`, `exams.read`, `marks.enter`, `announcements.send` with **ASSIGNED** scope; cannot create or publish exams |
| Admissions officer | School | Create students, link guardians, enroll, admissions pipeline and conversion |
| Accounts administrator | School | Configure fees, assign, collect, reverse, ledger create/update, reconcile |
| Accountant / cashier | School | Assign fees, collect, read ledger |
| Parent | Org | `family.read`, `students.read`, `attendance.read`, `fees.read`, `homework.read`, `exams.read` with **OWN_FAMILY** scope (published results only) |
| Front office | School | Look up students; log and progress admission enquiries (cannot admit) |
| HR, transport, hostel, librarian, helpdesk, student | School | Minimal read access until their modules exist |

After a release that adds permissions, run `npm run db:sync-roles` to update system roles in existing organizations.

## Finance rule

Only explicitly authorized finance roles (Accounts Administrator) and designated owners hold `finance.ledger.create`. A unit test asserts that list, and an integration test asserts teachers, principals, cashiers, group admins and parents are refused. A school grants more people ledger access by giving them a role that includes the permission, not by changing code.

## Privilege escalation

`inviteStaff` refuses to grant a role containing any permission the inviter does not hold in that school.

## Not yet implemented

Custom-role editor UI, MFA enforcement for privileged roles (the Better Auth two-factor plugin and tables are installed; enrollment and verification screens are pending).
