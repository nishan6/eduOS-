# Metric definitions

All metrics are computed server-side from persisted records. Timezone: Asia/Kolkata.

| Metric | Definition | Source |
| --- | --- | --- |
| Attendance rate | (present + late) ÷ (marked − excused), **submitted** sessions only. "No data" when the denominator is 0 | `StudentAttendance` via `attendance/calc.ts` |
| Sections submitted | Sections with a SUBMITTED daily session for the date ÷ sections in the current year | `AttendanceSession` |
| Absent today | ABSENT marks in submitted sessions today | `StudentAttendance` |
| Invoiced | Sum of non-void invoice totals | `Invoice.totalPaise` |
| Received | Sum of amounts allocated to invoices from non-reversed payments | `Invoice.paidPaise` (maintained from `PaymentAllocation`) |
| Outstanding | Invoiced − received. It is money owed, not revenue and not cash | `Invoice` |
| Overdue | Outstanding on invoices whose due date is before today | `Invoice.dueDate` |
| Fee aging | Outstanding bucketed by days past due: not yet due, 1–30, 31–60, 61–90, 90+ | `fees/calc.ts` |
| Collected today / this month | Sum of RECORDED payments by received date | `Payment` |
| Collection rate (owner) | Received ÷ invoiced for the current year | `Invoice` |

Cross-school comparisons use only these definitions, which are identical in every school. A School Health Score is intentionally not shown until its components and weights are agreed with management.
