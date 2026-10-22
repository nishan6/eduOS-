# Product requirements (summary)

The full brief is the "EduOS Master Product, Engineering & Implementation Brief". This file keeps the requirements that shape engineering, and tracks where each stands.

## Principles

1. AI-first, not AI-dependent: attendance, fees, permissions and results never depend on an AI provider.
2. Workflow-first: every workflow has an owner, status, permissions, audit history and outcome.
3. One source of truth: one student, one guardian per phone per organization, one enrollment per student per year.
4. Role-first experiences: parent, teacher, principal and owner homes are different screens.
5. Mobile-first for parents and teachers.
6. Configurable: boards, fee structures, roles and academic years are data.
7. Security by design: tenant isolation, server-side authorization, audit.

## Primary experiences

| Experience | Implemented | Pending |
| --- | --- | --- |
| Parent | Multi-school child switcher, today's attendance, 30-day rate, fees due and history, receipts, absence notifications, "needs attention" | Homework, exams, AI summary, bus status, leave requests, tickets, messages |
| Teacher | My classes, attendance marking (draft/submit), correction requests | Timetable, homework, assessments, leave, AI tools |
| Principal | Daily attendance overview, absentees, unsubmitted sections, correction approvals, fee summary | Admissions, tickets, transport/hostel incidents, health score |
| Owner | School comparison (students, attendance, collections, outstanding), drill-down into a school | Admissions funnel, expenses, trends, AI briefings |

## Acceptance criteria met

- A parent sees only linked children, across schools; URL tampering returns Not found.
- Attendance, fees and payment history come from persisted records.
- Unavailable bus tracking is labelled unavailable; no AI text is generated.
- Only finance roles and owners can write ledger entries.
- An authorized cashier records a collection, a receipt is issued, the balance updates for staff and parent.
