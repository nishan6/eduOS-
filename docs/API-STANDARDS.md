# Application service and API standards

EduOS has no public REST API yet. Internal boundaries are written so a mobile app or API layer can call the same services later.

## Services (`src/modules/<domain>/service.ts`)

Every exported function:

1. Takes the `Actor` as its first argument.
2. Parses untrusted input with a Zod schema via `parseInput` (server side, always).
3. Loads the target record and authorizes against the record's own school.
4. Uses one Prisma transaction for multi-row changes.
5. Writes an `AuditLog` entry for sensitive changes (ids and summaries, never secrets or full personal records).
6. Throws `AppError` with a code; never returns partial success silently.

## Error shape

```ts
type ActionResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INTERNAL";
      message: string; fieldErrors?: Record<string, string[]> };
```

Unexpected errors are logged server-side and returned as a generic `INTERNAL` message.

## Server actions (`src/app/**/actions.ts`)

Thin wrappers: `runAction(actor => service(actor, input))`. They contain no business logic.

## Conventions

- Pagination: page-based, 25 per page for directories (`PAGE_SIZE`). Large worklists are capped and sorted server-side.
- Idempotency: payment forms send a client-generated `idempotencyKey`; replays return the original payment.
- Money: integer paise in and out. Rupee parsing (`rupeesToPaise`) happens at the form edge and is validated again server-side.
- Dates: ISO `YYYY-MM-DD` strings for school dates; IST is the school timezone.
- Versioning: when a public API is added, prefix routes with `/api/v1` and keep services unchanged.
