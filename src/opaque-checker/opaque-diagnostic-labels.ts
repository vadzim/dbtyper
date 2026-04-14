import { normalizeLogicalPath } from "./opaque-cli-args.ts"
import type { TypeReference } from "./read-types.ts"

/** Negative if (fileA, refA) is strictly before (fileB, refB) in source order. */
export function compareOpaqueRefSpanOrder(
	fileA: string,
	refA: TypeReference,
	fileB: string,
	refB: TypeReference,
): number {
	const pa = normalizeLogicalPath(fileA)
	const pb = normalizeLogicalPath(fileB)
	if (pa !== pb) return pa < pb ? -1 : 1
	return refA.pos.start - refB.pos.start
}

/**
 * Whether this span is the earlier or later of two duplicate opaque usages (for diagnostic labels).
 */
export function occurrenceLabelRelativeToOther(
	file: string,
	ref: TypeReference,
	otherFile: string,
	otherRef: TypeReference,
): "first usage" | "second usage" {
	const c = compareOpaqueRefSpanOrder(file, ref, otherFile, otherRef)
	return c < 0 ? "first usage" : "second usage"
}
