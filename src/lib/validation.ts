import { z as zod, type z } from "zod";
import { invalid } from "@/lib/errors";

/** Validates untrusted input on the server and converts Zod issues into a VALIDATION AppError. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of r.error.issues) (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
    throw invalid(r.error.issues[0]?.message ?? "Please correct the highlighted fields.", fieldErrors);
  }
  return r.data;
}

/** Optional form field: an empty string (what HTML forms send for "nothing") becomes undefined. */
export function blankToUndefined<T extends z.ZodType>(schema: T) {
  return zod
    .union([zod.literal("").transform(() => undefined), schema])
    .optional()
    // A whitespace-only value that trims to "" inside `schema` is also treated as blank.
    .transform((v) => (v === "" ? undefined : v));
}
