/**
 * Pure grading helpers. Each school picks a scale (School.gradingScale) and pass mark; the
 * values are copied onto every exam at creation so later changes never rewrite published results.
 * See docs/DECISIONS.md D13 and D18.
 */

export type GradingScaleKey = "CBSE_9_POINT" | "AP_SSC_9_POINT";
type Band = { min: number; grade: string; point: number };

export const SCALES: Record<GradingScaleKey, { label: string; defaultPass: number; bands: Band[] }> = {
  CBSE_9_POINT: {
    label: "CBSE nine-point (A1 91–100 … E below 33)",
    defaultPass: 33,
    bands: [
      { min: 91, grade: "A1", point: 10 }, { min: 81, grade: "A2", point: 9 }, { min: 71, grade: "B1", point: 8 },
      { min: 61, grade: "B2", point: 7 }, { min: 51, grade: "C1", point: 6 }, { min: 41, grade: "C2", point: 5 },
      { min: 33, grade: "D", point: 4 }, { min: 0, grade: "E", point: 0 },
    ],
  },
  AP_SSC_9_POINT: {
    label: "AP state board nine-point (A1 92–100 … D2 35–42, E below 35)",
    defaultPass: 35,
    bands: [
      { min: 92, grade: "A1", point: 10 }, { min: 83, grade: "A2", point: 9 }, { min: 75, grade: "B1", point: 8 },
      { min: 67, grade: "B2", point: 7 }, { min: 59, grade: "C1", point: 6 }, { min: 51, grade: "C2", point: 5 },
      { min: 43, grade: "D1", point: 4 }, { min: 35, grade: "D2", point: 3 }, { min: 0, grade: "E", point: 0 },
    ],
  },
};

/** Default scale for callers that do not pass one (and for unit tests of the CBSE scale). */
export const PASS_PERCENT = SCALES.CBSE_9_POINT.defaultPass;
export type GradingRules = { scale: GradingScaleKey; passPercent: number };
const DEFAULT_RULES: GradingRules = { scale: "CBSE_9_POINT", passPercent: PASS_PERCENT };

/** Human-readable band list for report card footers. */
export function describeScale(scale: GradingScaleKey): string {
  const bands = SCALES[scale].bands;
  return bands.map((b, i) => (i === 0 ? `${b.grade} ${b.min}–100` : b.min === 0 ? `${b.grade} below ${bands[i - 1]!.min}` : `${b.grade} ${b.min}–${bands[i - 1]!.min - 1}`)).join(", ");
}

/** Percentage rounded to one decimal place. */
export function percent(marks: number, max: number): number {
  if (max <= 0) throw new Error("max must be positive");
  return Math.round((marks / max) * 1000) / 10;
}

/** Grade for a percentage. Percentages are compared after rounding up to a whole number, e.g. 90.5 → A1. */
export function gradeFor(pct: number, scale: GradingScaleKey = "CBSE_9_POINT"): { grade: string; point: number } {
  const bands = SCALES[scale].bands;
  const whole = Math.ceil(pct - 1e-9);
  const row = bands.find((r) => whole >= r.min) ?? bands[bands.length - 1]!;
  return { grade: row.grade, point: row.point };
}

export type SubjectResult = { subject: string; maxMarks: number; marks: number | null; isAbsent: boolean };

/**
 * Summarises one student's results for an exam. Absent counts as zero toward the total and as a
 * fail in that subject; a missing mark (null and not absent) makes the result incomplete.
 */
export function summarise(results: SubjectResult[], rules: GradingRules = DEFAULT_RULES) {
  const incomplete = results.some((r) => r.marks === null && !r.isAbsent);
  const rows = results.map((r) => {
    const obtained = r.isAbsent ? 0 : r.marks ?? 0;
    const pct = percent(obtained, r.maxMarks);
    const g = gradeFor(pct, rules.scale);
    return { ...r, percent: pct, grade: r.isAbsent ? "AB" : g.grade, passed: !r.isAbsent && pct >= rules.passPercent };
  });
  const total = rows.reduce((s, r) => s + (r.isAbsent ? 0 : r.marks ?? 0), 0);
  const max = rows.reduce((s, r) => s + r.maxMarks, 0);
  const overall = max > 0 ? percent(total, max) : 0;
  return {
    rows,
    total,
    max,
    percent: overall,
    grade: max > 0 ? gradeFor(overall, rules.scale).grade : "-",
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
