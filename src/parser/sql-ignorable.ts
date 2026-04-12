/** Parsed marker for SQL that is skipped for the internal table model (no-op on apply). */
export type IgnorableStatement = {
	readonly kind: "ignorable"
}
