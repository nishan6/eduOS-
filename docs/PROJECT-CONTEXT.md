# Project context

EduOS is being built as a commercial, multi-tenant School Operating System. The first customer is a school group piloting two schools.

## Pilot assumptions (configurable, not hardcoded)

- One management organization, two schools: one CBSE, one Andhra Pradesh State Board.
- More than 3,500 students, about 100 teachers, 30 administrative and 10 finance staff.
- About 150 hostel students at one school; 8–9 buses.
- Today: ScientificStudy ERP, Tally for accounting, manual student attendance, biometric staff attendance, cash/UPI fee collection, communication over phone, WhatsApp and SMS.

## What exists in this repository (October 2026)

- Next.js 15 App Router application, TypeScript strict, Tailwind CSS 4, PostgreSQL via Prisma 6, Better Auth for sessions.
- Organization → School hierarchy, role templates with scoped permissions, teacher section assignments, guardian/family links.
- Student directory, admission, guardian linking, enrollment, family app, attendance with corrections, fee structures, invoices, collections, receipts, reversals, ledger, audit log, invitations.
- Unit, integration and Playwright end-to-end tests.

## What does not exist yet

Homework, exams, admissions CRM, announcements, events, tickets, workflows engine, transport, hostel, HR, Tally export, payment gateway, SMS/WhatsApp, AI features, MFA enrollment UI, CSV import. See the roadmap.
