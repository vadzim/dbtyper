import path from "node:path"
import { parseConsumeTypeSpec } from "./opaque-type-checker.ts"

export type OpaqueTypeOption = {
	fileName: string
	typeName: string
}

export type OpaqueConsumerOption = {
	fileName: string
	typeName: string
	typeArgumentIndexes?: number[]
}

export class OpaqueCliParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "OpaqueCliParseError"
	}
}

/** Same logical path key as readTypes uses for TypeEntry.file/refFile. */
export function normalizeLogicalPath(filePath: string): string {
	const normalized = path.posix.normalize(filePath)
	if (normalized.startsWith("/")) return normalized
	return normalized === "." || normalized.startsWith("./") ? normalized : `./${normalized}`
}

export function parseOpaqueCliArgs(argv: readonly string[]): {
	opaqueTypes: OpaqueTypeOption[]
	opaqueConsumers: OpaqueConsumerOption[]
	globs: string[]
} {
	const opaqueTypes: OpaqueTypeOption[] = []
	const opaqueConsumers: OpaqueConsumerOption[] = []
	const globs: string[] = []
	for (let index = 0; index < argv.length; index++) {
		const token = argv[index]
		if (!token) continue
		if (token === "--opaque") {
			const fileName = argv[index + 1]
			const typeName = argv[index + 2]
			if (!fileName || !typeName) {
				throw new OpaqueCliParseError("missing arguments for --opaque (expected <file> <type-name>)")
			}
			opaqueTypes.push({ fileName: normalizeLogicalPath(fileName), typeName })
			index += 2
			continue
		}
		if (token === "--consumer" || token === "--consume" || token === "--opaque-consumer") {
			const fileName = argv[index + 1]
			const spec = argv[index + 2]
			if (!fileName || !spec) {
				throw new OpaqueCliParseError(
					`missing arguments for ${token} (expected <file> <TypeName[:idx[:idx...]]>)`,
				)
			}
			let parsed: { typeName: string; typeArgumentIndexes?: number[] }
			try {
				parsed = parseConsumeTypeSpec(spec)
			} catch {
				throw new OpaqueCliParseError(`Invalid ${token} spec: ${spec}`)
			}
			opaqueConsumers.push({ fileName: normalizeLogicalPath(fileName), ...parsed })
			index += 2
			continue
		}
		if (token.length > 0) globs.push(token)
	}
	return { opaqueTypes, opaqueConsumers, globs }
}
