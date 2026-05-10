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

// Error codes that cannot be tested in integration tests due to error recovery mechanisms
// These are generated during lexing or parser error recovery, not as primary parse errors
const UNTESTABLE_ERROR_CODES = new Set([
	// Lexer error recovery (8 codes)
	1001, // UNCLOSED_QUOTED_IDENTIFIER - Generated during lexing
	1002, // UNCLOSED_STRING_LITERAL - Generated during lexing
	1003, // UNCLOSED_TAGGED_STRING - Generated during lexing
	1004, // WRONG_STRING_TAG - Generated during lexing
	1005, // UNBALANCED_PARENTHESES - Never directly emitted
	1006, // TOKEN_NOT_FOUND - Error recovery fallback
	1008, // CLOSING_BRACKET_NOT_FOUND - Error recovery
	1009, // UNMATCHED_CLOSING_BRACKET - Error recovery

	// Parser error recovery - SELECT (7 codes)
	1101, // EXPECTED_SELECT_IN_SUBQUERY
	1103, // EXPECTED_SELECT_IN_EXISTS_SUBQUERY
	1104, // EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW
	1105, // EXPECTED_SEMICOLON_AFTER_SELECT
	1112, // EXPECTED_ALIAS_AFTER_CTE
	1115, // EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE
	1120, // EXPECTED_TABLE_NAME_AFTER_DOT_IN_FROM

	// Parser error recovery - INSERT (17 codes)
	1201, // EXPECTED_SEMICOLON_AFTER_INSERT
	1202, // EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT
	1203, // EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES
	1204, // EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS
	1205, // EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT
	1206, // EXPECTED_COLUMN_NAME_IN_INSERT_COLUMN_LIST
	1207, // EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST
	1210, // EXPECTED_CONFLICT_AFTER_ON_IN_INSERT
	1211, // EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT
	1212, // EXPECTED_COLUMN_NAME_IN_ON_CONFLICT
	1213, // EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST
	1214, // EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT
	1215, // EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT
	1216, // EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT
	1217, // EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT
	1218, // EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE
	1219, // EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE

	// Parser error recovery - UPDATE (8 codes)
	1300, // EXPECTED_SET_IN_UPDATE
	1301, // EXPECTED_SET_AFTER_TABLE_IN_UPDATE
	1302, // EXPECTED_SEMICOLON_AFTER_UPDATE
	1303, // EXPECTED_COLUMN_NAME_IN_UPDATE_SET
	1304, // EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET
	1305, // EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT
	1307, // EXPECTED_TABLE_NAME_IN_UPDATE_FROM
	1308, // EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE

	// Parser error recovery - DELETE (5 codes)
	1401, // EXPECTED_SEMICOLON_AFTER_DELETE
	1402, // EXPECTED_TABLE_NAME_IN_DELETE_FROM
	1403, // EXPECTED_TABLE_NAME_IN_DELETE_USING
	1404, // EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM
	1405, // EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM

	// Parser error recovery - DDL (16 codes)
	1501, // EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE
	1502, // EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE
	1503, // EXPECTED_COLUMN_NAME_IN_CREATE_TABLE
	1504, // EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE
	1505, // EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION
	1507, // EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE
	1508, // EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE
	1509, // EXPECTED_DEFAULT_VALUE
	1600, // EXPECTED_SEMICOLON_AFTER_ALTER_TABLE
	1601, // EXPECTED_TABLE_AFTER_ALTER
	1602, // EXPECTED_TABLE_NAME_IN_ALTER_TABLE
	1603, // EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE
	1604, // EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE
	1605, // EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN
	1606, // EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN
	3905, // EXPECTED_SEMICOLON_AFTER_CREATE_VIEW - SELECT parser consumes trailing tokens

	// Obsolete error codes (3 codes)
	1222, // OBSOLETE_1222_EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET
	1223, // OBSOLETE_1223_INVALID_VALUE_EXPRESSION_IN_INSERT
	1224, // OBSOLETE_1224_INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE

	// Expression syntax errors that are difficult to trigger (4 codes)
	4300, // CASE_REQUIRES_AT_LEAST_ONE_WHEN - Parser handles CASE END as valid empty case
	4700, // EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT - Lexer/parser recovery makes this hard to trigger
	4702, // EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE - Lexer/parser recovery makes this hard to trigger
	4802, // EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN - Parser recovery handles missing operator
])

describe("Error code coverage", async () => {
	it("every error code in the registry should be tested in at least one integration test", async () => {
		// Get all error codes from the registry
		const allErrorCodes = Object.keys(errors).map(code => parseInt(code, 10))

		// Filter out untestable error codes
		const testableCodes = allErrorCodes.filter(code => !UNTESTABLE_ERROR_CODES.has(code))

		// Get all error codes used in tests
		const testedErrorCodes = await extractErrorCodesFromTests(integrationDir)

		// Find untested error codes (excluding untestable ones)
		const untestedCodes = testableCodes.filter(code => !testedErrorCodes.has(code))

		if (untestedCodes.length > 0) {
			const untestedDetails = untestedCodes
				.map(code => {
					const error = errors[code as keyof typeof errors]
					return `  - ${code}: ${error?.id ?? "unknown"}`
				})
				.join("\n")

			assert.fail(
				`Found ${untestedCodes.length} testable error code(s) without integration tests:\n${untestedDetails}\n\nPlease add integration tests for these error codes.\n\nNote: ${UNTESTABLE_ERROR_CODES.size} error codes are excluded as untestable (lexer/error recovery).`,
			)
		}

		// Success: all testable error codes are tested
		const totalCodes = allErrorCodes.length
		const untestableCodes = UNTESTABLE_ERROR_CODES.size
		const testedCount = testableCodes.length
		assert.ok(
			true,
			`All ${testedCount} testable error codes are covered by integration tests (${untestableCodes} untestable codes excluded, ${totalCodes} total)`,
		)
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
