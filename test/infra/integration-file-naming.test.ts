import { readdir, stat, readFile } from "fs/promises"
import { join } from "path"
import { describe, it } from "node:test"
import assert from "node:assert"

const ALLOWED_EXTENSIONS = [".success.test.ts", ".error.test.ts", ".success.test.skip.ts", ".error.test.skip.ts"]

async function* getIntegrationTestFiles(dir: string, substr: string = ""): AsyncGenerator<string> {
	const entries = await readdir(dir)

	for (const entry of entries) {
		const fullPath = join(dir, entry)
		const stats = await stat(fullPath)

		if (stats.isDirectory()) {
			yield* getIntegrationTestFiles(fullPath, substr)
		} else if (stats.isFile() && fullPath.includes(substr)) {
			yield fullPath
		}
	}
}

const integrationDir = join(process.cwd(), "test", "integration")

describe("Integration test files correctness", async () => {
	for await (const fullPath of getIntegrationTestFiles(integrationDir)) {
		const file = fullPath.replace(integrationDir, "")

		await describe(`Correctness of file ${file}`, async () => {
			await it(`the file ${file} should have one of the allowed extensions`, async () => {
				const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => file.endsWith(ext))
				assert.ok(
					hasValidExtension,
					`File must end with one of: ${ALLOWED_EXTENSIONS.join(", ")}. Hint: consider splitting this file into multiple smaller test files with correct extensions.`,
				)
			})

			const content = await readFile(fullPath, "utf-8")

			await it(`the file ${file} should call sqlMigrations exactly once`, async () => {
				const matches = content.match(/\bsqlMigrations\(/g)
				const matchCount = matches ? matches.length : 0

				assert.strictEqual(
					matchCount,
					1,
					`Found ${matchCount} occurrence(s), expected exactly 1. Hint: consider splitting this file into multiple smaller test files.`,
				)
			})

			await it(`the file ${file} should call .query or .stream at most once`, async () => {
				const queryMatches = content.match(/\.query\(/g)
				const streamMatches = content.match(/\.stream\(/g)
				const queryCount = queryMatches ? queryMatches.length : 0
				const streamCount = streamMatches ? streamMatches.length : 0
				const totalCount = queryCount + streamCount

				assert.ok(
					totalCount <= 1,
					`Found ${queryCount} .query() and ${streamCount} .stream() call(s), expected at most 1 total. Hint: consider splitting this file into multiple smaller test files.`,
				)
			})

			if (file.includes(".success.test.")) {
				await it(`the file ${file} must not include @ts-expect-error`, async () => {
					const tsExpectErrorRegex = /\/[/*]\s*@ts-expect-error/

					assert.ok(
						!tsExpectErrorRegex.test(content),
						"Success test files must not include @ts-expect-error. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})

				await it(`the file ${file} must not contain error markers`, async () => {
					assert.ok(
						!content.includes("❌"),
						"Success test files must not contain ❌. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
					assert.ok(
						!/\berror\b/i.test(content),
						"Success test files must not contain the word ERROR. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})

				if (content.includes(".query(") || content.includes(".stream(")) {
					await it(`the file ${file} must have a type check for the result because it tests success and uses .query() or .stream()`, async () => {
						// Accept both single-line and multi-line formats (prettier may format differently)
						const hasTypeCheck = /\btype _check = Expect<\s*Matches<\s*typeof _?result,/.test(content)
						assert.ok(
							hasTypeCheck,
							"Success test files must have a type check in the form (`type _check = Expect<Matches<typeof result, ...`). For testing .stream(..) use `const result /* or _result */ = await Array.fromAsync(await db.stream(`",
						)
					})
				}
			}

			if (file.includes(".error.test.")) {
				await it(`the file ${file} must include exactly one @ts-expect-error`, async () => {
					const tsExpectErrorRegex = /\/[/*]\s*@ts-expect-error/g
					const matches = content.match(tsExpectErrorRegex)
					const matchCount = matches ? matches.length : 0

					assert.strictEqual(
						matchCount,
						1,
						`Found ${matchCount} occurrence(s), expected exactly 1. Hint: consider splitting this file into multiple smaller test files.`,
					)
				})

				await it(`the file ${file} should have @ts-expect-error right before query call`, async () => {
					const pattern =
						/\/[/*]\s*@ts-expect-error\s*(\n|\*\/)\s*(await\s+db\.(query|stream)\(query[^)]*\)|await\s+migrations\.apply\(query[^)]*\))/

					assert.ok(
						pattern.test(content),
						"@ts-expect-error should be immediately before 'await db.query(query)' or 'await db.stream(query)' or 'await migrations.apply(query)'.",
					)
				})

				await it(`the file ${file} must define query as const`, async () => {
					const hasQueryConst = /\bconst\s+query\s*=\s*`[^`]*`\s+as\s+const/.test(content)
					assert.ok(hasQueryConst, "Error test files must define: const query = `...` as const")
				})

				await it(`the file ${file} must have error message check`, async () => {
					const hasErrorCheck =
						/\btype\s+\w+\s*=\s*Expect<\s*(Matches|Extends)<\s*(ExtractQueryError|ExtractResultError)</.test(
							content,
						)
					assert.ok(
						hasErrorCheck,
						"Error test files must include: type _errorCheck = Expect<Matches<ExtractQueryError<DbShape, typeof query>, DbtyperError<...>>> or Expect<Extends<...>> for union types, or SqlSelectRow for stream tests",
					)
				})

				await it(`the file ${file} must not contain success markers`, async () => {
					assert.ok(
						!content.includes("✅"),
						"Error test files must not contain ✅. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
					assert.ok(
						!/\bsuccess\b/i.test(content),
						"Error test files must not contain the word SUCCESS. Hint: consider splitting this file into multiple smaller test files, separating success and error cases.",
					)
				})
			}
		})
	}

	it("test/integration should contain at least one file", async () => {
		for await (const _file of getIntegrationTestFiles(integrationDir)) {
			return
		}

		assert.fail("test/integration directory should contain at least one file")
	})

	it("test/integration should contain at least one .success. test file", async () => {
		for await (const file of getIntegrationTestFiles(integrationDir)) {
			if (file.includes(".success.test.")) {
				return
			}
		}

		assert.fail("test/integration should contain at least one .success. test file")
	})

	it("test/integration should contain at least one .error. test file", async () => {
		for await (const file of getIntegrationTestFiles(integrationDir)) {
			if (file.includes(".error.test.")) {
				return
			}
		}

		assert.fail("test/integration should contain at least one .error. test file")
	})
})
