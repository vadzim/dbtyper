import fg from "fast-glob"
import { readFile } from "node:fs/promises"
import { readTypes, type ReadTypesOptions, type ReadTypesResult } from "./read-types.ts"

export async function readTypesFromFiles(
	masks: string[],
	options: Omit<ReadTypesOptions, "idPrefix"> = {},
): Promise<ReadTypesResult> {
	const paths = await fg(masks, { onlyFiles: true, unique: true })
	const combined: ReadTypesResult = {
		types: [],
		scopes: [],
	}

	for (const [index, filePath] of paths.entries()) {
		const content = await readFile(filePath, { encoding: "utf8" })
		const result = readTypes(filePath, content, {
			...options,
			idPrefix: `f${index}:`,
		})
		combined.types.push(...result.types)
		combined.scopes.push(...result.scopes)
	}

	return combined
}
