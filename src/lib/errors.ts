/** Structured application errors. Services throw these; actions convert them to ActionResult. */
export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (message = "You do not have permission to do that.") => new AppError("FORBIDDEN", message);
export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const invalid = (message: string, fieldErrors?: Record<string, string[]>) =>
  new AppError("VALIDATION", message, fieldErrors);

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; code: ErrorCode | "INTERNAL"; message: string; fieldErrors?: Record<string, string[]> };

export function toActionError(err: unknown): Extract<ActionResult, { ok: false }> {
  if (err instanceof AppError) return { ok: false, code: err.code, message: err.message, fieldErrors: err.fieldErrors };
  // Never leak internals to the client; log server-side without request payloads.
  console.error("[eduos] unexpected error", err instanceof Error ? err.message : err);
  return { ok: false, code: "INTERNAL", message: "Something went wrong. Please try again." };
}
