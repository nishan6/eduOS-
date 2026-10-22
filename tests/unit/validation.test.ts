import { describe, expect, it } from "vitest";
import { z } from "zod";
import { blankToUndefined, parseInput } from "@/lib/validation";

describe("blankToUndefined", () => {
  const schema = z.object({ subjectId: blankToUndefined(z.string()), note: blankToUndefined(z.string().trim().max(5)), on: blankToUndefined(z.string().regex(/^\d{4}$/)) });

  it("turns empty form values into undefined instead of empty strings", () => {
    expect(parseInput(schema, { subjectId: "", note: "   ", on: "" })).toEqual({ subjectId: undefined, note: undefined, on: undefined });
    expect(parseInput(schema, {})).toEqual({});
  });

  it("still validates non-empty values", () => {
    expect(parseInput(schema, { subjectId: "s1", note: " hi ", on: "2026" })).toEqual({ subjectId: "s1", note: "hi", on: "2026" });
    expect(() => parseInput(schema, { on: "26" })).toThrow();
    expect(() => parseInput(schema, { note: "too long" })).toThrow();
  });
});
