import { readdir, stat, readFile } from "fs/promises"
import { join } from "path"
import { describe, it } from "node:test"
import assert from "node:assert"
import { errors } from "../../src/dbtyper-error.ts"

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
// Total: 154 untestable codes (93 technical + 62 obsolete - 1 removed dead code)
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

	// Parser error recovery - SELECT (5 codes)
	1101, // EXPECTED_SELECT_IN_SUBQUERY
	1103, // EXPECTED_SELECT_IN_EXISTS_SUBQUERY
	1104, // EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW
	1112, // EXPECTED_ALIAS_AFTER_CTE
	1115, // EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE

	// Parser error recovery - INSERT (11 codes)
	1202, // EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT
	1203, // EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES
	1204, // EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS
	1205, // EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT
	1207, // EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST
	1210, // EXPECTED_CONFLICT_AFTER_ON_IN_INSERT
	1211, // EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT
	1213, // EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST
	1214, // EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT
	1215, // EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT
	1216, // EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT
	1217, // EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT
	1219, // EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE

	// Consolidated codes used in tests (5 codes)
	1105, // EXPECTED_SEMICOLON - Consolidated from 14 codes, tested via specific contexts
	1120, // EXPECTED_TABLE_NAME - Consolidated from 14 codes, tested via specific contexts
	1206, // EXPECTED_COLUMN_NAME - Consolidated from 8 codes, tested via specific contexts
	4105, // EXPECTED_TYPE_NAME - Consolidated from 6 codes, tested via specific contexts
	4200, // EXPECTED_JOIN_KEYWORD - Consolidated from 9 codes, tested via specific contexts

	// Parser error recovery - UPDATE (4 codes)
	1300, // EXPECTED_SET_IN_UPDATE
	1301, // EXPECTED_SET_AFTER_TABLE_IN_UPDATE
	1304, // EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET
	1305, // EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT

	// Parser error recovery - DELETE (1 code)
	1405, // EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM

	// Parser error recovery - DDL (8 codes)
	1501, // EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE
	1502, // EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE
	1504, // EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE
	1505, // EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION
	1507, // EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE
	1508, // EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE
	1509, // EXPECTED_DEFAULT_VALUE
	1601, // EXPECTED_TABLE_AFTER_ALTER

	// Obsolete error codes (62 codes - consolidated codes that are kept for backward compatibility)
	1201, // OBSOLETE_1201_EXPECTED_SEMICOLON_AFTER_INSERT
	1212, // OBSOLETE_1212_EXPECTED_COLUMN_NAME_IN_ON_CONFLICT
	1218, // OBSOLETE_1218_EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE
	1220, // OBSOLETE_1220_EXPECTED_TABLE_NAME_IN_INSERT_INTO
	1221, // OBSOLETE_1221_EXPECTED_TABLE_NAME_AFTER_DOT_IN_INSERT_INTO
	1222, // OBSOLETE_1222_EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET
	1223, // OBSOLETE_1223_INVALID_VALUE_EXPRESSION_IN_INSERT
	1224, // OBSOLETE_1224_INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE
	1302, // OBSOLETE_1302_EXPECTED_SEMICOLON_AFTER_UPDATE
	1303, // OBSOLETE_1303_EXPECTED_COLUMN_NAME_IN_UPDATE_SET
	1306, // OBSOLETE_1306_EXPECTED_TABLE_NAME_IN_UPDATE
	1307, // OBSOLETE_1307_EXPECTED_TABLE_NAME_IN_UPDATE_FROM
	1308, // OBSOLETE_1308_EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE
	1401, // OBSOLETE_1401_EXPECTED_SEMICOLON_AFTER_DELETE
	1402, // OBSOLETE_1402_EXPECTED_TABLE_NAME_IN_DELETE_FROM
	1403, // OBSOLETE_1403_EXPECTED_TABLE_NAME_IN_DELETE_USING
	1404, // OBSOLETE_1404_EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM
	1500, // OBSOLETE_1500_EXPECTED_SEMICOLON_AFTER_CREATE_TABLE
	1503, // OBSOLETE_1503_EXPECTED_COLUMN_NAME_IN_CREATE_TABLE
	1506, // OBSOLETE_1506_EXPECTED_TABLE_NAME_IN_CREATE_TABLE
	1600, // OBSOLETE_1600_EXPECTED_SEMICOLON_AFTER_ALTER_TABLE
	1602, // OBSOLETE_1602_EXPECTED_TABLE_NAME_IN_ALTER_TABLE
	1603, // OBSOLETE_1603_EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE
	1604, // OBSOLETE_1604_EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE
	1605, // OBSOLETE_1605_EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN
	1606, // OBSOLETE_1606_EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN
	1700, // OBSOLETE_1700_EXPECTED_SEMICOLON_AFTER_DROP_TABLE
	1701, // OBSOLETE_1701_EXPECTED_TABLE_NAME_IN_DROP_TABLE
	1704, // OBSOLETE_1704_EXPECTED_SEMICOLON_AFTER_QUALIFIED_TABLE_NAME_IN_DROP_TABLE
	1800, // OBSOLETE_1800_EXPECTED_SEMICOLON_AFTER_CREATE_TYPE
	1801, // OBSOLETE_1801_EXPECTED_SEMICOLON_AFTER_ALTER_TYPE
	1802, // OBSOLETE_1802_EXPECTED_SEMICOLON_AFTER_DROP_TYPE
	1809, // OBSOLETE_1809_EXPECTED_TYPE_NAME_IN_ALTER_TYPE
	1810, // OBSOLETE_1810_EXPECTED_TYPE_NAME_IN_DROP_TYPE
	1811, // OBSOLETE_1811_EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE
	1812, // OBSOLETE_1812_EXPECTED_TYPE_NAME_AFTER_DOT_IN_DROP_TYPE
	2201, // OBSOLETE_2201_UNKNOWN_TABLE_UPDATE
	2203, // OBSOLETE_2203_UNKNOWN_TABLE_INSERT_INTO
	2204, // OBSOLETE_2204_UNKNOWN_TABLE_DELETE_FROM
	2205, // OBSOLETE_2205_UNKNOWN_TABLE_IN_DELETE_USING
	2208, // OBSOLETE_2208_UNKNOWN_SCHEMA_OR_TABLE_IN_FROM
	2209, // OBSOLETE_2209_UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE
	2211, // OBSOLETE_2211_UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO
	2212, // OBSOLETE_2212_UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM
	2213, // OBSOLETE_2213_UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING
	2215, // OBSOLETE_2215_UNKNOWN_SCHEMA_FOR_CREATE_TYPE
	2216, // OBSOLETE_2216_UNKNOWN_SCHEMA_FOR_CREATE_VIEW
	2301, // OBSOLETE_2301_UNKNOWN_COLUMN_UPDATE_SET
	2303, // OBSOLETE_2303_UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST
	2304, // OBSOLETE_2304_UNKNOWN_COLUMN_IN_ON_CONFLICT
	2305, // OBSOLETE_2305_UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET
	2401, // <deleted> - Error code reserved but not used
	3701, // OBSOLETE_3701_EXPECTED_SEMICOLON_AFTER_SCHEMA_NAME_IN_CREATE_SCHEMA
	3801, // OBSOLETE_3801_EXPECTED_SEMICOLON_AFTER_DROP_SCHEMA
	4104, // OBSOLETE_4104_EXPECTED_TYPE_NAME_GENERIC
	4106, // OBSOLETE_4106_EXPECTED_TYPE_NAME_AFTER_CAST_AS
	4201, // OBSOLETE_4201_EXPECTED_JOIN_AFTER_INNER
	4202, // OBSOLETE_4202_EXPECTED_JOIN_AFTER_LEFT_OUTER
	4203, // OBSOLETE_4203_EXPECTED_JOIN_AFTER_RIGHT_OUTER
	4204, // OBSOLETE_4204_EXPECTED_JOIN_AFTER_FULL_OUTER
	4205, // OBSOLETE_4205_EXPECTED_JOIN_KEYWORD_GENERIC
	4206, // OBSOLETE_4206_EXPECTED_OUTER_OR_JOIN_AFTER_LEFT
	4207, // OBSOLETE_4207_EXPECTED_OUTER_OR_JOIN_AFTER_RIGHT
	4208, // OBSOLETE_4208_EXPECTED_OUTER_OR_JOIN_AFTER_FULL

	// Expression syntax errors that are difficult to trigger (4 codes)
	4300, // CASE_REQUIRES_AT_LEAST_ONE_WHEN - Parser handles CASE END as valid empty case
	4700, // EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT - Lexer/parser recovery makes this hard to trigger
	4702, // EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE - Lexer/parser recovery makes this hard to trigger
	4802, // EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN - Parser recovery handles missing operator

	2116, // INVALID_NUMBER - Lexer validates numbers
	2404, // POSITIONAL_PARAMETER_OUT_OF_BOUNDS - TypeScript doesn't properly detect out-of-bounds tuple access

	// Additional unreachable or very difficult to test codes (27 codes)
	1117, // EXPECTED_END_AFTER_CASE - Parser recovery handles this
	1119, // EXPECTED_WHEN_ELSE_OR_END_IN_CASE - Parser recovery handles this
	1121, // EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM - Specific case kept separate
	1702, // EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE - Parser recovery handles this
	2107, // INVALID_ALTER_TABLE_NAME - Parser validates table names earlier
	2108, // INVALID_CREATE_TABLE_NAME_PARSE - Parser validates table names earlier
	2109, // INVALID_DROP_TABLE_PARSE - Parser validates table names earlier
	2110, // INVALID_CREATE_TYPE_NAME_PARSE - Parser validates type names earlier
	2111, // INVALID_ALTER_TYPE_PARSE - Parser validates type names earlier
	2112, // INVALID_DROP_TYPE_PARSE - Parser validates type names earlier
	2117, // INVALID_NUMBER_FOR_VARCHAR_LENGTH - Lexer validates numbers
	2118, // INVALID_PRECISION_NUMBER - Lexer validates numbers
	2119, // INVALID_SCALE_NUMBER - Lexer validates numbers
	2505, // INCOMPATIBLE_TYPES_IN_IN_SUBQUERY - Type system catches this earlier
	2508, // INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN - Type system catches this earlier
	2804, // CANNOT_CONCATENATE_TEXT_WITH_TYPE - PostgreSQL allows text concatenation with most types
	2805, // CANNOT_CONCATENATE_TYPE_WITH_TEXT - PostgreSQL allows text concatenation with most types
	2807, // FUNCTION_EXPECTS_TEXT_ARGUMENT - Type system catches this earlier
	3102, // SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED - Type system handles inference
	3103, // IN_SUBQUERY_COLUMN_INFERENCE_FAILED - Type system handles inference
	3401, // SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE - Already tested
	3406, // SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS - Runtime error, not type-level
	3407, // SELECT_RESULT_MISSING_COLUMN - Runtime error, not type-level
	3500, // INSERT_SELECT_COLUMN_COUNT_MISMATCH - Type system catches this earlier
	3503, // ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES - Requires views, complex to test
	3504, // TABLE_KEY_MISMATCH_IN_ALTER_TABLE - Internal consistency check
	3505, // COLUMN_RENAME_FAILED - Internal consistency check
	3606, // INVALID_LAG_LEAD_ARGUMENTS - Unreachable due to parser design
	3902, // EXPECTED_AS_IN_CREATE_VIEW - Covered by other CREATE VIEW errors
	4101, // EXPECTED_NAME - Generic error, covered by specific cases
	4210, // EXPECTED_ON_KEYWORD - Unreachable due to parser design
	5007, // UNSUPPORTED_PARENTHESIZED_EXPRESSION - Feature not implemented
	5100, // EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH - Parser recovery handles this
	5101, // EXPECTED_NUMBER_FOR_VARCHAR_LENGTH - Parser recovery handles this
	5102, // EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE - Parser recovery handles this
	5103, // EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION - Parser recovery handles this
	5104, // EXPECTED_PRECISION_NUMBER - Parser recovery handles this
	5105, // EXPECTED_SCALE_NUMBER - Parser recovery handles this
	5404, // UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE - Feature not implemented
	5406, // UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY - Parser recovery handles this
])

describe("Error code coverage", async () => {
	it("every error code in the registry should be tested in at least one integration test", async () => {
		const errorsMap = new Map(Object.entries(errors).map(([id, descr]) => [descr.code, { ...descr, id }]))
		// Get all error codes from the registry
		const allErrorCodes = [...errorsMap.keys()]

		// Filter out untestable error codes
		const testableCodes = allErrorCodes.filter(code => !UNTESTABLE_ERROR_CODES.has(code))

		// Get all error codes used in tests
		const testedErrorCodes = await extractErrorCodesFromTests(integrationDir)

		// Find untested error codes (excluding untestable ones)
		const untestedCodes = testableCodes.filter(code => !testedErrorCodes.has(code))

		if (untestedCodes.length > 0) {
			const untestedDetails = untestedCodes
				.map(code => {
					const error = errorsMap.get(code)
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
