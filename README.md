# EduOS

An AI-native operating system for K–12 school groups: one platform for student records, attendance, fees, finance, admissions, communication and operations, with role-specific experiences for parents, teachers, principals and owners.

**Status:** Milestones A (foundation), B (student → guardian → attendance → parent slice) and C (fees → invoice → payment → receipt → balance) are implemented and tested. See [docs/IMPLEMENTATION-ROADMAP.md](docs/IMPLEMENTATION-ROADMAP.md).

## Quick start

```bash
cp .env.example .env            # fill DATABASE_URL, TEST_DATABASE_URL, BETTER_AUTH_SECRET
npm install
npx prisma migrate deploy       # create tables
npm run db:seed                 # fictional demo data (refuses to run twice or in production)
npm run dev                     # http://localhost:3000
```

Sign in with any demo account from [docs/RUNNING.md](docs/RUNNING.md) (password `EduOS-demo-2026!`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` (strict) |
| `npm test` | Unit + integration tests (creates and drops its own throwaway database) |
| `npm run test:e2e` | Playwright end-to-end workflows (run `npm run build` first) |
| `npm run db:migrate` | Create a new migration in development |
| `npm run db:seed` | Seed demo data |

## Documentation

- [Running, demo accounts, troubleshooting](docs/RUNNING.md)
- [Project context](docs/PROJECT-CONTEXT.md) · [Product requirements](docs/MASTER-PRD.md)
- [System architecture](docs/SYSTEM-ARCHITECTURE.md) · [Database](docs/DATABASE-ARCHITECTURE.md) · [Multi-tenancy](docs/MULTI-TENANCY.md)
- [RBAC](docs/RBAC.md) · [API standards](docs/API-STANDARDS.md) · [Metric definitions](docs/METRICS.md)
- [Roadmap](docs/IMPLEMENTATION-ROADMAP.md) · [Decisions](docs/DECISIONS.md)
