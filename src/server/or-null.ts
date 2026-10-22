import "server-only";
import { AppError } from "@/lib/errors";

/** For pages: turn an expected access or not-found AppError into null, rethrow anything else. */
export async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError) return null;
    throw e;
  }
}
