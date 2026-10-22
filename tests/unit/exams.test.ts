import { describe, expect, it } from "vitest";
import { describeScale, gradeFor, percent, summarise, validateMark } from "@/modules/exams/calc";

describe("grading", () => {
  it("maps percentages to the nine-point scale at the boundaries", () => {
    expect(gradeFor(100).grade).toBe("A1");
    expect(gradeFor(91).grade).toBe("A1");
    expect(gradeFor(90.5).grade).toBe("A1");
    expect(gradeFor(90).grade).toBe("A2");
    expect(gradeFor(41).grade).toBe("C2");
    expect(gradeFor(33).grade).toBe("D");
    expect(gradeFor(32.9).grade).toBe("D");
    expect(gradeFor(32).grade).toBe("E");
    expect(gradeFor(0).grade).toBe("E");
  });

  it("computes percentages to one decimal", () => {
    expect(percent(18.5, 25)).toBe(74);
    expect(percent(1, 3)).toBe(33.3);
    expect(() => percent(1, 0)).toThrow();
  });

  it("validates marks", () => {
    expect(validateMark(12.5, 25)).toBeNull();
    expect(validateMark(25, 25)).toBeNull();
    expect(validateMark(26, 25)).toMatch(/exceed/);
    expect(validateMark(-1, 25)).toMatch(/negative/);
    expect(validateMark(12.3, 25)).toMatch(/half/);
    expect(validateMark(Number.NaN, 25)).toMatch(/number/);
  });

  it("summarises results: absent fails the subject, missing marks make it incomplete", () => {
    const s = summarise([
      { subject: "Maths", maxMarks: 50, marks: 45, isAbsent: false },
      { subject: "English", maxMarks: 50, marks: 30, isAbsent: false },
    ]);
    expect(s).toMatchObject({ total: 75, max: 100, percent: 75, grade: "B1", passed: true, incomplete: false });

    const absent = summarise([
      { subject: "Maths", maxMarks: 50, marks: 45, isAbsent: false },
      { subject: "English", maxMarks: 50, marks: null, isAbsent: true },
    ]);
    expect(absent.passed).toBe(false);
    expect(absent.rows[1]!.grade).toBe("AB");
    expect(absent.total).toBe(45);

    const missing = summarise([{ subject: "Maths", maxMarks: 50, marks: null, isAbsent: false }]);
    expect(missing).toMatchObject({ incomplete: true, passed: false });

    const failing = summarise([{ subject: "Maths", maxMarks: 50, marks: 10, isAbsent: false }]);
    expect(failing).toMatchObject({ passed: false, grade: "E" });
  });
});

describe("AP state-board scale", () => {
  it("uses its own bands and pass mark", () => {
    expect(gradeFor(92, "AP_SSC_9_POINT").grade).toBe("A1");
    expect(gradeFor(91, "AP_SSC_9_POINT").grade).toBe("A2");
    expect(gradeFor(35, "AP_SSC_9_POINT").grade).toBe("D2");
    expect(gradeFor(34, "AP_SSC_9_POINT").grade).toBe("E");
    const r = summarise([{ subject: "Telugu", maxMarks: 100, marks: 34, isAbsent: false }], { scale: "AP_SSC_9_POINT", passPercent: 35 });
    expect(r).toMatchObject({ passed: false, grade: "E" });
    expect(summarise([{ subject: "Telugu", maxMarks: 100, marks: 34, isAbsent: false }]).passed).toBe(true);
  });

  it("describes bands for report card footers", () => {
    expect(describeScale("CBSE_9_POINT")).toBe("A1 91–100, A2 81–90, B1 71–80, B2 61–70, C1 51–60, C2 41–50, D 33–40, E below 33");
    expect(describeScale("AP_SSC_9_POINT")).toContain("D2 35–42, E below 35");
  });
});
