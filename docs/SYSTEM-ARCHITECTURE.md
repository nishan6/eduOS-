# System architecture

A modular monolith: one Next.js application and one PostgreSQL database.

```
Browser ─▶ Next.js (App Router)
            ├─ middleware.ts          optimistic signed-out redirect only
            ├─ src/app/**             pages (server components) + server actions
            │    └─ actions.ts        thin: requireActor → service → ActionResult
            ├─ src/modules/<domain>   application services (all business rules)
            │    ├─ service.ts        validate (Zod) → authorize → transaction → audit
            │    └─ calc.ts           pure domain math, unit tested
            ├─ src/server             actor loading, guards, sequences, action wrapper
            └─ src/lib                auth, permissions, tenant, audit, integrations, ui utils
          ─▶ PostgreSQL (Prisma)
```

## Request flow

1. Middleware redirects requests without a session cookie to `/login`. This is a convenience, not security.
2. A page or action calls `requireActor()`, which validates the session in the database (Better Auth) and builds an **Actor**: grants (permission + scope + school), accessible schools, assigned sections, guardian id.
3. The page calls a **service** with the actor. Services validate input with Zod, check permissions with `can()` / `canSchoolWide()` / family checks, run multi-row changes in a transaction, and write audit events.
4. Services throw `AppError` (`FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`). Actions convert them into a typed `ActionResult`; pages convert access errors into Not found.

React components never contain authorization or money arithmetic. Client components only collect input and display results.

## Modules

| Module | Responsibility |
| --- | --- |
| `identity` | Role template sync, invitations, activation, staff membership |
| `org` | Schools, classes/sections, teacher assignment, owner overview, audit reads |
| `students` | Admission, guardians (deduplicated by phone), enrollment, directory |
| `family` | Guardian-linked access check, parent home aggregation |
| `attendance` | Rosters, marking, submission, corrections, school/student reports |
| `fees` | Categories, structures, assignment and invoicing, collections, reversals, summaries |
| `finance` | Chart of accounts, system postings, manual journals, reversals |

## Integrations (adapter boundaries)

- **Email**: `src/lib/integrations/email.ts`. Without a provider, messages go to the `DevOutboxMessage` table and are never sent.
- Payments, SMS, WhatsApp, GPS, biometric devices, Tally and AI providers are not implemented. Each will get an adapter in `src/lib/integrations/` with an explicit "not configured" state.

## Background work

Not needed yet. When notifications fan out to SMS/WhatsApp or Tally export runs on a schedule, add a durable job table plus a worker (or a managed queue) rather than doing it in request handlers.
