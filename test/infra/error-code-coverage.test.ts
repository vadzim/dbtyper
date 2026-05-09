import { readdir, stat, readFile } from "fs/promises"
import { join } from "path"
import { describe, it } from "node:test"
import assert from "node:assert"
import { errors } from "../../src/sql-parser-error.ts"

async function* getIntegrationTestFiles(dir: string): AsyncGenerator<string> {
	const entries = await readdir(dir)

	for (const entry of entries) {
		const fullPath = join(dir, entry)
		const stats = await stat(fullPath)

		if (stats.isDirectory()) {
			yield* getIntegrationTestFiles(fullPath)
		} else if (stats.isFile() && fullPath.endsWith(".error.test.ts")) {
			yield fullPath
		}
	}
}

async function extractErrorCodesFromTests(integrationDir: string): Promise<Set<number>> {
	const errorCodes = new Set<number>()

	for await (const filePath of getIntegrationTestFiles(integrationDir)) {
		const content = await readFile(filePath, "utf-8")

		// Match DbtyperError<CODE, ...> patterns
		// This regex looks for DbtyperError<number, where number is the error code
		const matches = content.matchAll(/DbtyperError<\s*(\d+)\s*,/g)

		for (const match of matches) {
			if (match[1]) {
				const code = parseInt(match[1], 10)
				errorCodes.add(code)
			}
		}
	}

	return errorCodes
}

const integrationDir = join(process.cwd(), "test", "integration")

describe("Error code coverage", async () => {
	it("every error code in the registry should be tested in at least one integration test", async () => {
		// Get all error codes from the registry
		const allErrorCodes = Object.keys(errors).map(code => parseInt(code, 10))

		// Get all error codes used in tests
		const testedErrorCodes = await extractErrorCodesFromTests(integrationDir)

		// Find untested error codes
		const untestedCodes = allErrorCodes.filter(code => !testedErrorCodes.has(code))

		if (untestedCodes.length > 0) {
			const untestedDetails = untestedCodes
				.map(code => {
					const error = errors[code as keyof typeof errors]
					return `  - ${code}: ${error?.id ?? "unknown"}`
				})
				.join("\n")

			assert.fail(
				`Found ${untestedCodes.length} error code(s) without integration tests:\n${untestedDetails}\n\nPlease add integration tests for these error codes.`,
			)
		}

		// Success: all error codes are tested
		assert.ok(true, `All ${allErrorCodes.length} error codes are covered by integration tests`)
	})

	it("should have at least one error code defined", async () => {
		const allErrorCodes = Object.keys(errors)
		assert.ok(allErrorCodes.length > 0, "Error registry should contain at least one error code")
	})

	it("should have at least one integration test file", async () => {
		let count = 0
		for await (const _file of getIntegrationTestFiles(integrationDir)) {
			count++
		}
		assert.ok(count > 0, "Should have at least one integration test file")
	})
})
