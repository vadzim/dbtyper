// TODO:

// ensure that all error codes except 9999 is covered by error tests

import { describe, it } from "node:test"
import assert from "node:assert"
import { getIntegrationTestFiles } from "./integration-test-utils.ts"

const ALLOWED_EXTENSIONS = [
	".success.test-d.ts",
	".error.test-d.ts",
	".success.test-d.skip.ts",
	".error.test-d.skip.ts",
]

describe("Integration test files correctness", async () => {
	const files = await getIntegrationTestFiles()

	for await (const { file, contentIO } of files) {
		const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => file.endsWith(ext))
		if (!hasValidExtension) {
			it(`the file ${file} should have one of the allowed extensions`, () => {
				assert.fail(
					`File must end with one of: ${ALLOWED_EXTENSIONS.join(", ")}. Hint: consider splitting this file into multiple smaller test files with correct extensions.`,
				)
			})
			continue
		}

		const content = await contentIO
		const noSpacesContent = content.replaceAll(/\s|\n|\r/g, "")

		const matches = content.match(/\bsqlMigrations\(/g)
		const matchCount = matches ? matches.length : 0

		if (matchCount !== 1) {
			it(`the file ${file} should call sqlMigrations exactly once`, () => {
				assert.fail(
					`Found ${matchCount} occurrence(s), expected exactly 1. Hint: consider splitting this file into multiple smaller test files.`,
				)
			})
		}

		const queryMatches = content.match(/\.query\(/g)
		const streamMatches = content.match(/\.stream\(/g)
		const queryCount = queryMatches ? queryMatches.length : 0
		const streamCount = streamMatches ? streamMatches.length : 0
		const totalCount = queryCount + streamCount

		if (totalCount > 1) {
			await it(`the file ${file} should call .query or .stream at most once`, async () => {
				assert.fail(
					`Found ${queryCount} .query() and ${streamCount} .stream() call(s), expected at most 1 total. Hint: consider splitting this file into multiple smaller test files.`,
				)
			})
		}

		if (file.includes(".success.test")) {
			const tsExpectErrorRegex = /\/[/*]\s*@ts-expect-error/

			if (tsExpectErrorRegex.test(content)) {
				await it(`the file ${file} must not include @ts-expect-error`, async () => {
					assert.fail(
						"Success test files must not include @ts-expect-error. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}

			if (content.includes("❌")) {
				await it(`the file ${file} must not contain error markers`, async () => {
					assert.fail(
						"Success test files must not contain ❌. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}

			if (/\berror\b/i.test(content)) {
				await it(`the file ${file} must not contain error markers`, async () => {
					assert.fail(
						"Success test files must not contain the word ERROR. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}

			if (noSpacesContent.includes(".query(") || content.includes(".stream(")) {
				const hasTypeCheck =
					/\btype _check = Expect<\s*Matches<\s*typeof _?result,/.test(content) ||
					/expectType<typeof_?result>\(toBe</.test(noSpacesContent)

				if (!hasTypeCheck) {
					it(`the file ${file} must have a type check for the result because it tests success and uses .query() or .stream()`, () => {
						assert.fail(
							"Success test files must have a type check in the form (`expectType<typeof _?result>(toBe< ...`). For testing .stream(..) use `const result /* or _result */ = await Array.fromAsync(await db.stream(`",
						)
					})
				}
			}
		}

		if (file.includes(".error.test")) {
			const tsExpectErrorRegex = /\/[/*]\s*@ts-expect-error/g
			const matches = content.match(tsExpectErrorRegex)
			const matchCount = matches ? matches.length : 0

			if (matchCount !== 1) {
				await it(`the file ${file} must include exactly one @ts-expect-error`, async () => {
					assert.fail(
						`Found ${matchCount} occurrence(s), expected exactly 1. Hint: consider splitting this file into multiple smaller test files.`,
					)
				})
			}

			const validTsExpectError =
				/\/[/*]\s*@ts-expect-error\s*(\n|\*\/)\s*(await\s+db\.(query|stream)\(query[^)]*\)|migrations\.apply\(query[^)]*\))/.test(
					content,
				)
			if (!validTsExpectError) {
				await it(`the file ${file} should have @ts-expect-error right before query call`, async () => {
					assert.fail(
						"@ts-expect-error should be immediately before 'await db.query(query)' or 'await db.stream(query)' or 'migrations.apply(query)'.",
					)
				})
			}

			const hasQueryConst = /\bconst\s+query\s*=\s*`[^`]*`\s+as\s+const/.test(content)
			if (!hasQueryConst) {
				await it(`the file ${file} must define query as const`, async () => {
					assert.fail("Error test files must define: const query = `...` as const")
				})
			}

			const hasErrorCheck =
				/typeReturnedError=Get(Query|Stream|Apply)Error<typeof(db|migrations),typeofquery.*?>;?expectType<ReturnedError>\(toBe<\|?DbtyperError</.test(
					noSpacesContent,
				)
			if (!hasErrorCheck) {
				await it(`the file ${file} must have error message check`, async () => {
					assert.fail(
						"Error test files must include: type ReturnedError = Get(Query|Stream|Apply)Error<typeof (db|migrations), typeof query>; expectType<ReturnedError>(toBe<DbtyperError<",
					)
				})
			}

			if (content.includes("✅")) {
				await it(`the file ${file} must not contain success markers`, async () => {
					assert.fail(
						"Error test files must not contain ✅. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}

			if (/\bsuccess\b/i.test(content)) {
				await it(`the file ${file} must not contain success markers`, async () => {
					assert.fail(
						"Error test files must not contain the word SUCCESS. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}
		}
	}

	if (!files.find(f => f.fullPath.includes(".success.test"))) {
		it("test/integration should contain at least one .success. test file", () => {
			assert.fail("test/integration should contain at least one .success. test file")
		})
	}

	if (!files.find(f => f.fullPath.includes(".error.test"))) {
		it("test/integration should contain at least one .error. test file", () => {
			assert.fail("test/integration should contain at least one .error. test file")
		})
	}
})
