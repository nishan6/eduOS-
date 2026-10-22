# Running EduOS

## Prerequisites

- Node.js 22+, npm 10+
- PostgreSQL 15+ (16 used in development). The database user needs `CREATEDB` to run the test suites, because each test run creates and later drops its own database.

## Environment

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Application database |
| `TEST_DATABASE_URL` | for tests | Name must end in `_test`. Tests create `<name>_<timestamp>` next to it and drop only that |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | Public base URL, e.g. `https://eduos.example.com` |
| `EDUOS_ENV` | yes | `development`, `staging` or `production`. Production disables the dev outbox, hides activation links and blocks the seed |
| `EMAIL_PROVIDER` | no | Unset = development outbox (`/app/settings/outbox`), nothing is delivered |
| `EDUOS_SIGNIN_RATE_MAX` | no | Sign-in attempts per minute per IP (default 10) |

## First run

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The seed refuses to run if the demo organization already exists and when `EDUOS_ENV=production`. It never deletes data. To start over in development, drop and recreate your **development** database yourself, then rerun the two commands above.

## Demo accounts (fictional development data)

Password for every account: `EduOS-demo-2026!`

| Email | Role | Lands on |
| --- | --- | --- |
| owner@demo.eduos.test | Organization owner (both schools, ledger authority) | Group overview |
| groupadmin@demo.eduos.test | Group administrator (no ledger writes) | Group overview |
| principal.sps@demo.eduos.test | Principal, Sunrise Public School (CBSE) | School overview |
| principal.svl@demo.eduos.test | Principal, Sunrise Vidyalaya (AP State Board) | School overview |
| teacher.sps@demo.eduos.test | Teacher, class teacher of SPS Class 6-A, also 6-B | My classes |
| teacher2.sps@demo.eduos.test | Teacher, SPS Class 7-A | My classes |
| teacher.svl@demo.eduos.test | Teacher, SVL Class 7-A | My classes |
| accounts.sps@demo.eduos.test | Accounts administrator, SPS | Fees |
| cashier.sps@demo.eduos.test / cashier.svl@demo.eduos.test | Cashier | Fees |
| admissions.sps@demo.eduos.test | Admissions officer, SPS | Students |
| parent@demo.eduos.test | Parent with children in **both** schools (Aanya, SPS 6-A; Vivaan, SVL 7-A) | My children |
| parent2@demo.eduos.test | Parent with one child (Kabir, SPS 6-B) | My children |

## Try the workflows

1. **Attendance.** Sign in as `teacher.sps`, open Class 6-A, mark Aanya absent, "Mark rest present", Submit. Sign in as `parent`: the home screen says Aanya is absent, and a notification is waiting.
2. **Correction.** As the teacher, "Request correction" on Aanya's row. As `principal.sps`, approve it under Pending approvals. The parent now sees "present".
3. **Fees.** As `cashier.sps`, Fees → search "Aanya" → record ₹1,000 by UPI with a UTR. Open the receipt. The parent's outstanding balance drops by ₹1,000.
4. **New student and parent login.** As `admissions.sps`, Students → New student, with a guardian. On the student page, "Invite to app" shows an activation link (development only). Open it in a private window, set a password, sign in: the guardian sees only that child.
5. **Access control.** As a teacher, open `/app/finance` or another school's student URL: Not found.
6. **New school.** As `owner`, School setup → Add a school.

## Tests

```bash
npm run lint && npm run typecheck
npm test                  # unit + integration (needs TEST_DATABASE_URL and CREATEDB)
npm run build && npm run test:e2e
```

If Playwright's bundled browser is not installed, set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium binary or run `npx playwright install chromium`. `KEEP_TEST_DB=1` keeps the per-run database for debugging.

## Deployment

EduOS is a standard Next.js server application plus PostgreSQL.

1. Provision managed PostgreSQL (with automated backups and point-in-time recovery) and set `DATABASE_URL`.
2. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EDUOS_ENV=production`.
3. Deploy with `npm ci && npx prisma migrate deploy && npm run build`, start with `npm start`. Vercel works: set the build command to `prisma migrate deploy && next build`.
4. Never run `npm run db:seed` or any reset against staging or production.

Use separate databases and secrets for development, staging and production.

## Backup and restore

- Rely on the managed provider's daily snapshots and point-in-time recovery for production.
- Logical backup: `pg_dump --format=custom --no-owner "$DATABASE_URL" > eduos-$(date +%F).dump`
- Restore into a **new, empty** database: `createdb eduos_restore && pg_restore --no-owner -d eduos_restore eduos-YYYY-MM-DD.dump`, verify, then repoint `DATABASE_URL`.
- Test a restore at least monthly during the pilot.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Incorrect email or password" for demo users | Seed has not run against this database |
| "Too many attempts" | Sign-in rate limit; wait a minute or raise `EDUOS_SIGNIN_RATE_MAX` in development |
| Tests fail with "permission denied to create database" | Grant `CREATEDB` to the test user |
| Invitation emails never arrive | Expected without `EMAIL_PROVIDER`; see `/app/settings/outbox` |
| Activation link not shown | It is hidden when `EDUOS_ENV=production` |
