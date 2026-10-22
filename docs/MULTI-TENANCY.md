# Multi-tenancy

Hierarchy: **Platform → Organization (school group) → School → optional Campus**.

## Isolation model

- Every school-owned table has `schoolId`. Every service resolves the target record's school first and authorizes against **that** school, never against a school id supplied by the client alone.
- A user enters a school as staff only through an ACTIVE `UserSchoolMembership` or an organization-wide role assignment. School-level role assignments are ignored without an active membership, so suspending a membership removes access immediately (sessions are also revoked).
- The school selector cookie is only a preference. `getActiveSchool()` honours it only if the actor is authorized for that school.
- Guardians are organization-scoped, so one family can have children in several schools of the same group. Parents get **no** staff access to any school; they reach student data only through `StudentGuardianRelationship` links.
- Records outside the actor's scope return **Not found**, not "Forbidden", so their existence is not revealed.

## Tests

`tests/integration/tenancy.test.ts` and the e2e "unauthorized access" scenario cover: cross-school reads, teacher section limits, cross-family reads, and section smuggling (submitting a student from another section).

## Future hardening

PostgreSQL row-level security as a second layer (set `app.school_ids` per transaction). It will complement, not replace, application authorization.
