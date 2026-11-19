import type { Errors } from "../dbtyper-error.ts"

/**
 * The 3501 message as a run-time string (drivers and migrations throw it). `satisfies` ties it to the registry text,
 * so the copies cannot drift from src/dbtyper-error.ts.
 */
export const STREAM_REQUIRES_ROWS_MESSAGE =
	"stream() requires a row-returning statement (SELECT or RETURNING clause)" satisfies Errors["STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT"]["msg"][0]
