/**
 * Pure grading helpers. The scale is the CBSE nine-point scale (also how most Andhra
 * Pradesh state-board schools report grades). Pass mark is 33% per subject.
 * See docs/DECISIONS.md D13.
 */

export const PASS_PERCENT = 33;

const SCALE: { min: number; grade: string; point: number }[] = [
  { min: 91, grade: "A1", point: 10 },
  { min: 81, grade: "A2", point: 9 },
  { min: 71, grade: "B1", point: 8 },
  { min: 61, grade: "B2", point: 7 },
  { min: 51, grade: "C1", point: 6 },
  { min: 41, grade: "C2", point: 5 },
  { min: 33, grade: "D", point: 4 },
  { min: 0, grade: "E", point: 0 },
];

/** Percentage rounded to one decimal place. */
export function percent(marks: number, max: number): number {
  if (max <= 0) throw new Error("max must be positive");
  return Math.round((marks / max) * 1000) / 10;
}

/** Grade for a percentage. Percentages are compared after rounding up to a whole number, e.g. 90.5 → A1. */
export function gradeFor(pct: number): { grade: string; point: number } {
  const whole = Math.ceil(pct - 1e-9);
  const row = SCALE.find((r) => whole >= r.min) ?? SCALE[SCALE.length - 1]!;
  return { grade: row.grade, point: row.point };
}

export type SubjectResult = { subject: string; maxMarks: number; marks: number | null; isAbsent: boolean };

/**
 * Summarises one student's results for an exam. Absent counts as zero toward the total and as a
 * fail in that subject; a missing mark (null and not absent) makes the result incomplete.
 */
export function summarise(results: SubjectResult[]) {
  const incomplete = results.some((r) => r.marks === null && !r.isAbsent);
  const rows = results.map((r) => {
    const obtained = r.isAbsent ? 0 : r.marks ?? 0;
    const pct = percent(obtained, r.maxMarks);
    const g = gradeFor(pct);
    return { ...r, percent: pct, grade: r.isAbsent ? "AB" : g.grade, passed: !r.isAbsent && pct >= PASS_PERCENT };
  });
  const total = rows.reduce((s, r) => s + (r.isAbsent ? 0 : r.marks ?? 0), 0);
  const max = rows.reduce((s, r) => s + r.maxMarks, 0);
  const overall = max > 0 ? percent(total, max) : 0;
  return {
    rows,
    total,
    max,
    percent: overall,
    grade: max > 0 ? gradeFor(overall).grade : "-",
    passed: !incomplete && rows.length > 0 && rows.every((r) => r.passed),
    incomplete,
  };
}

/** Validates one mark against the paper's maximum. Half marks are allowed. */
export function validateMark(marks: number, max: number): string | null {
  if (!Number.isFinite(marks)) return "Enter a number";
  if (marks < 0) return "Marks cannot be negative";
  if (marks > max) return `Marks cannot exceed ${max}`;
  if (Math.round(marks * 2) !== marks * 2) return "Use whole or half marks";
  return null;
}
