import type { Dec, Tuple, TupleSize } from "./core/type-utils.ts"

export type Errors = {
	-readonly [K in keyof typeof errors]: {
		code: (typeof errors)[K]["code"]
		id: K
		msg: (typeof errors)[K]["msg"]
	}
}

export type ErrorIds = keyof Errors

export type ErrorCodes = Errors[ErrorIds]["code"]

export type FormatError<ED extends ErrorDescription, Args extends ErrorArgs<ED>> = DbtyperError<
	ED["code"],
	JoinWithArgs<ED["msg"], Args>
>

export type DbtyperError<Code extends number, Message extends string> = {
	__sql_parser_error_code__: Code
	__sql_parser_error__: Message
}

export type DbtyperErrorShape = {
	__sql_parser_error_code__: number
	__sql_parser_error__: string
}

type ErrorDescription = {
	code: number
	msg: [string, ...string[]]
}

/**
 * Error Code Registry
 *
 * This registry maps error codes to error messages with unique identifiers.
 *
 * Error Code Ranges (4-digit scheme with 100-code intervals):
 * - 1000-1099: Lexer/Tokenization Errors
 * - 1100-1199: Parser/SELECT Statement Errors
 * - 1200-1299: Parser/INSERT Statement Errors
 * - 1300-1399: Parser/UPDATE Statement Errors
 * - 1400-1499: Parser/DELETE Statement Errors
 * - 1500-1599: Parser/CREATE TABLE Errors
 * - 1600-1699: Parser/ALTER TABLE Errors
 * - 1700-1799: Parser/DROP TABLE Errors
 * - 1800-1899: Parser/CREATE/ALTER/DROP TYPE Errors
 * - 2000-2099: Validation/Expression Errors
 * - 2100-2199: Validation/Statement Errors
 * - 2200-2299: Resolution/Table-Schema Errors
 * - 2300-2399: Resolution/Column Errors
 * - 2400-2499: Resolution/Other Errors
 * - 2500-2599: Type/Compatibility Errors
 * - 2600-2699: Type/Boolean Errors
 * - 2700-2799: Type/NULL Handling Errors
 * - 2800-2899: Type/Text Operations Errors
 * - 2900-2999: Type/Numeric Operations Errors
 * - 3000-3099: Type/Array Operations Errors
 * - 3100-3199: Type/Subquery Errors
 * - 3200-3299: Semantic/Duplicate-Existence Errors
 * - 3300-3399: Semantic/Constraint Errors
 * - 3400-3499: Semantic/SELECT Errors
 * - 3500-3599: Semantic/Statement Errors
 * - 3600-3699: Semantic/Function Errors
 * - 3700-3799: DDL/CREATE SCHEMA Errors
 * - 3800-3899: DDL/DROP SCHEMA Errors
 * - 3900-3999: DDL/CREATE VIEW Errors
 * - 4000-4099: DDL/ALTER TYPE Errors
 * - 4100-4199: DDL/Misc Errors
 * - 4200-4299: DML/JOIN Errors
 * - 4300-4399: DML/CASE Errors
 * - 4400-4499: DML/BETWEEN-IN Errors
 * - 4500-4599: DML/CAST Errors
 * - 4600-4699: DML/Window Function Errors
 * - 4700-4799: DML/Array Errors
 * - 4800-4899: DML/Operator Errors
 * - 4900-4999: DML/EXISTS Errors
 * - 5000-5099: DML/Misc Expression Errors
 * - 5100-5199: Type-Data/VARCHAR-NUMERIC Errors
 * - 5200-5299: Type-Data/DEFAULT Value Errors
 * - 5300-5399: Type-Data/FETCH-LIMIT Errors
 * - 5400-5499: Type-Data/Misc Errors
 *
 * Guidelines for adding new error codes:
 * 1. Choose appropriate code range based on error category
 * 2. Create unique SCREAMING_SNAKE_CASE identifier
 * 3. Use array format for messages with interpolation: ["part1", "part2"]
 * 4. Use single-element array for static messages: ["message"]
 * 5. Ensure no duplicate IDs (compile-time check will catch this)
 * 6. Ensure no duplicate messages (compile-time check will catch this)
 * 7. Never reuse error code. If you delete error, mark that as OBSOLETE_<CODE>. The codes are used in online project help.
 */
export const errors = {
	// Lexer/Tokenization Errors
	UNCLOSED_QUOTED_IDENTIFIER: {
		code: 1001,
		msg: ["Unclosed quoted identifier literal"],
	},
	UNCLOSED_STRING_LITERAL: {
		code: 1002,
		msg: ["Unclosed string literal"],
	},
	UNCLOSED_TAGGED_STRING: {
		code: 1003,
		msg: ["Unclosed tagged string"],
	},
	WRONG_STRING_TAG: {
		code: 1004,
		msg: ["Wrong string tag"],
	},
	UNBALANCED_PARENTHESES: {
		code: 1005,
		msg: ["Unbalanced parentheses"],
	},
	TOKEN_NOT_FOUND: {
		code: 1006,
		msg: ["Token not found"],
	},
	UNEXPECTED_TOKEN: {
		code: 1007,
		msg: ["Unexpected token"],
	},
	CLOSING_BRACKET_NOT_FOUND: {
		code: 1008,
		msg: ["Closing bracket not found: ", ""],
	},
	UNMATCHED_CLOSING_BRACKET: {
		code: 1009,
		msg: ["Unmatched closing bracket: ", ""],
	},
	INVALID_INDEXED_PARAM: {
		code: 1010,
		msg: ["Invalid indexed parameter: ", ""],
	},

	// Parser Syntax Errors - Expected Keywords/Tokens
	// SELECT Statement
	EXPECTED_SELECT_AFTER_WITH: {
		code: 1100,
		msg: ["Expected SELECT after WITH clause"],
	},
	EXPECTED_SELECT_IN_SUBQUERY: {
		code: 1101,
		msg: ["Expected SELECT in subquery"],
	},
	EXPECTED_SELECT_IN_DERIVED_TABLE: {
		code: 1102,
		msg: ["Expected SELECT in derived table"],
	},
	EXPECTED_SELECT_IN_EXISTS_SUBQUERY: {
		code: 1103,
		msg: ["Expected SELECT in EXISTS subquery"],
	},
	EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW: {
		code: 1104,
		msg: ["Expected SELECT or WITH after AS in CREATE VIEW"],
	},
	// Group 1: EXPECTED_SEMICOLON (consolidated from 14 codes)
	EXPECTED_SEMICOLON: {
		code: 1105,
		msg: ["Expected semicolon after ", ""],
	},
	EXPECTED_FROM_AFTER_SELECT_LIST: {
		code: 1106,
		msg: ["Expected FROM after SELECT list"],
	},
	EXPECTED_BY_AFTER_GROUP: {
		code: 1107,
		msg: ["Expected BY after GROUP"],
	},
	EXPECTED_BY_AFTER_ORDER: {
		code: 1108,
		msg: ["Expected BY after ORDER"],
	},
	EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE: {
		code: 1109,
		msg: ["Expected BY after ORDER in OVER clause"],
	},
	EXPECTED_BY_AFTER_PARTITION: {
		code: 1110,
		msg: ["Expected BY after PARTITION"],
	},
	EXPECTED_CTE_NAME_IN_WITH: {
		code: 1111,
		msg: ["Expected CTE name in WITH"],
	},
	EXPECTED_ALIAS_AFTER_CTE: {
		code: 1112,
		msg: ["Expected alias after CTE"],
	},
	EXPECTED_ALIAS_AFTER_DERIVED_TABLE: {
		code: 1113,
		msg: ["Expected alias after derived table"],
	},
	EXPECTED_ALIAS_NAME_AFTER_AS: {
		code: 1114,
		msg: ["Expected alias name after AS"],
	},
	EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE: {
		code: 1115,
		msg: ["Expected alias or join clause after table"],
	},
	EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH: {
		code: 1116,
		msg: ["Expected open paren after AS in WITH"],
	},
	EXPECTED_END_AFTER_CASE: {
		code: 1117,
		msg: ["Expected END after CASE"],
	},
	EXPECTED_WHEN_AFTER_CASE_EXPRESSION: {
		code: 1118,
		msg: ["Expected WHEN after CASE expression"],
	},
	EXPECTED_WHEN_ELSE_OR_END_IN_CASE: {
		code: 1119,
		msg: ["Expected WHEN ELSE or END in CASE"],
	},
	// Group 2: EXPECTED_TABLE_NAME (consolidated from 14 codes)
	EXPECTED_TABLE_NAME: {
		code: 1120,
		msg: ["Expected table name ", ""],
	},
	EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM: {
		code: 1121,
		msg: ["Expected table name or `(` in FROM"],
	},

	// INSERT Statement
	EXPECTED_INTO_AFTER_INSERT: {
		code: 1200,
		msg: ["Expected INTO after INSERT"],
	},
	OBSOLETE_1201_EXPECTED_SEMICOLON_AFTER_INSERT: {
		code: 1201,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT: {
		code: 1202,
		msg: ["Expected `(` after VALUES in INSERT"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES: {
		code: 1203,
		msg: ["Expected `)` after INSERT values"],
	},
	EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS: {
		code: 1204,
		msg: ["Expected `(` after `,` between INSERT VALUES rows"],
	},
	EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT: {
		code: 1205,
		msg: ["Expected `(` (column list) after table in INSERT"],
	},
	// Group 3: EXPECTED_COLUMN_NAME (consolidated from 8 codes)
	EXPECTED_COLUMN_NAME: {
		code: 1206,
		msg: ["Expected column name ", ""],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST: {
		code: 1207,
		msg: ["Expected `,` or `)` in INSERT column list"],
	},
	EXPECTED_COMMA_BETWEEN_INSERT_VALUES: {
		code: 1208,
		msg: ["Expected `,` between INSERT values"],
	},
	EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT: {
		code: 1209,
		msg: ["Expected VALUES or SELECT after column list in INSERT"],
	},
	EXPECTED_CONFLICT_AFTER_ON_IN_INSERT: {
		code: 1210,
		msg: ["Expected CONFLICT after ON in INSERT"],
	},
	EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT: {
		code: 1211,
		msg: ["Expected `(` after ON CONFLICT in INSERT"],
	},
	OBSOLETE_1212_EXPECTED_COLUMN_NAME_IN_ON_CONFLICT: {
		code: 1212,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST: {
		code: 1213,
		msg: ["Expected `,` or `)` in ON CONFLICT column list"],
	},
	EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT: {
		code: 1214,
		msg: ["Expected DO after ON CONFLICT column list in INSERT"],
	},
	EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT: {
		code: 1215,
		msg: ["Expected DO after ON CONFLICT columns in INSERT"],
	},
	EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT: {
		code: 1216,
		msg: ["Expected UPDATE after DO in INSERT ON CONFLICT"],
	},
	EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT: {
		code: 1217,
		msg: ["Expected SET after UPDATE in INSERT ON CONFLICT"],
	},
	OBSOLETE_1218_EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE: {
		code: 1218,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE: {
		code: 1219,
		msg: ["Expected `=` after column in ON CONFLICT UPDATE"],
	},
	OBSOLETE_1220_EXPECTED_TABLE_NAME_IN_INSERT_INTO: {
		code: 1220,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1221_EXPECTED_TABLE_NAME_AFTER_DOT_IN_INSERT_INTO: {
		code: 1221,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1222_EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET: {
		code: 1222,
		msg: ["Expected `,`, WHERE, or end after ON CONFLICT SET"],
	},
	OBSOLETE_1223_INVALID_VALUE_EXPRESSION_IN_INSERT: {
		code: 1223,
		msg: ["Invalid value expression in INSERT"],
	},
	OBSOLETE_1224_INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE: {
		code: 1224,
		msg: ["Invalid value expression in ON CONFLICT UPDATE"],
	},

	// UPDATE Statement
	EXPECTED_SET_IN_UPDATE: {
		code: 1300,
		msg: ["Expected SET in UPDATE"],
	},
	EXPECTED_SET_AFTER_TABLE_IN_UPDATE: {
		code: 1301,
		msg: ["Expected SET after table in UPDATE"],
	},
	OBSOLETE_1302_EXPECTED_SEMICOLON_AFTER_UPDATE: {
		code: 1302,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	OBSOLETE_1303_EXPECTED_COLUMN_NAME_IN_UPDATE_SET: {
		code: 1303,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET: {
		code: 1304,
		msg: ["Expected `=` after column in UPDATE SET"],
	},
	EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT: {
		code: 1305,
		msg: ["Expected `,`, FROM, WHERE, or end after UPDATE assignment"],
	},
	OBSOLETE_1306_EXPECTED_TABLE_NAME_IN_UPDATE: {
		code: 1306,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1307_EXPECTED_TABLE_NAME_IN_UPDATE_FROM: {
		code: 1307,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1308_EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE: {
		code: 1308,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},

	// DELETE Statement
	EXPECTED_FROM_AFTER_DELETE: {
		code: 1400,
		msg: ["Expected FROM after DELETE"],
	},
	OBSOLETE_1401_EXPECTED_SEMICOLON_AFTER_DELETE: {
		code: 1401,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	OBSOLETE_1402_EXPECTED_TABLE_NAME_IN_DELETE_FROM: {
		code: 1402,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1403_EXPECTED_TABLE_NAME_IN_DELETE_USING: {
		code: 1403,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1404_EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM: {
		code: 1404,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM: {
		code: 1405,
		msg: ["Expected alias or end of table in DELETE FROM"],
	},

	// CREATE TABLE
	OBSOLETE_1500_EXPECTED_SEMICOLON_AFTER_CREATE_TABLE: {
		code: 1500,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE: {
		code: 1501,
		msg: ["Expected `(` before column list in CREATE TABLE"],
	},
	EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE: {
		code: 1502,
		msg: ["Expected `)` before end of CREATE TABLE"],
	},
	OBSOLETE_1503_EXPECTED_COLUMN_NAME_IN_CREATE_TABLE: {
		code: 1503,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE: {
		code: 1504,
		msg: ["Expected column type in CREATE TABLE"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION: {
		code: 1505,
		msg: ["Expected `,` or `)` after column definition"],
	},
	OBSOLETE_1506_EXPECTED_TABLE_NAME_IN_CREATE_TABLE: {
		code: 1506,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE: {
		code: 1507,
		msg: ["Expected `not` after `IF` in CREATE TABLE"],
	},
	EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE: {
		code: 1508,
		msg: ["Expected `exists` after `IF NOT` in CREATE TABLE"],
	},
	EXPECTED_DEFAULT_VALUE: {
		code: 1509,
		msg: ["Expected DEFAULT value"],
	},

	// ALTER TABLE
	OBSOLETE_1600_EXPECTED_SEMICOLON_AFTER_ALTER_TABLE: {
		code: 1600,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_TABLE_AFTER_ALTER: {
		code: 1601,
		msg: ["Expected TABLE after ALTER"],
	},
	OBSOLETE_1602_EXPECTED_TABLE_NAME_IN_ALTER_TABLE: {
		code: 1602,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1603_EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE: {
		code: 1603,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	OBSOLETE_1604_EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE: {
		code: 1604,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	OBSOLETE_1605_EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN: {
		code: 1605,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	OBSOLETE_1606_EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN: {
		code: 1606,
		msg: ["Use EXPECTED_COLUMN_NAME with context parameter"],
	},
	EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE: {
		code: 1607,
		msg: ["Expected column type in ALTER TABLE"],
	},
	EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN: {
		code: 1608,
		msg: ["Expected TYPE, SET, or DROP after ALTER COLUMN"],
	},
	EXPECTED_NULL_AFTER_SET_NOT: {
		code: 1609,
		msg: ["Expected NULL after SET NOT"],
	},

	// DROP TABLE
	OBSOLETE_1700_EXPECTED_SEMICOLON_AFTER_DROP_TABLE: {
		code: 1700,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	OBSOLETE_1701_EXPECTED_TABLE_NAME_IN_DROP_TABLE: {
		code: 1701,
		msg: ["Use EXPECTED_TABLE_NAME with context parameter"],
	},
	EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE: {
		code: 1702,
		msg: ["Expected `exists` after `IF` in DROP TABLE"],
	},
	EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE: {
		code: 1703,
		msg: ["Expected `.` or end of table name in DROP TABLE"],
	},
	OBSOLETE_1704_EXPECTED_SEMICOLON_AFTER_QUALIFIED_TABLE_NAME_IN_DROP_TABLE: {
		code: 1704,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},

	// CREATE/ALTER/DROP TYPE
	OBSOLETE_1800_EXPECTED_SEMICOLON_AFTER_CREATE_TYPE: {
		code: 1800,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	OBSOLETE_1801_EXPECTED_SEMICOLON_AFTER_ALTER_TYPE: {
		code: 1801,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	OBSOLETE_1802_EXPECTED_SEMICOLON_AFTER_DROP_TYPE: {
		code: 1802,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_AS_AFTER_TYPE_NAME_IN_CREATE_TYPE: {
		code: 1803,
		msg: ["Expected `as` after type name in CREATE TYPE"],
	},
	EXPECTED_ENUM_AFTER_AS_IN_CREATE_TYPE: {
		code: 1804,
		msg: ["Expected `enum` after `AS` in CREATE TYPE"],
	},
	EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE: {
		code: 1805,
		msg: ["Expected `(` before enum values in CREATE TYPE"],
	},
	EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_CREATE_TYPE: {
		code: 1806,
		msg: ["Expected string literal for enum value in CREATE TYPE"],
	},
	EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE: {
		code: 1807,
		msg: ["Expected string literal for enum value in ALTER TYPE"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_ENUM_VALUE_IN_CREATE_TYPE: {
		code: 1808,
		msg: ["Expected `,` or `)` after enum value in CREATE TYPE"],
	},
	OBSOLETE_1809_EXPECTED_TYPE_NAME_IN_ALTER_TYPE: {
		code: 1809,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	OBSOLETE_1810_EXPECTED_TYPE_NAME_IN_DROP_TYPE: {
		code: 1810,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	OBSOLETE_1811_EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE: {
		code: 1811,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	OBSOLETE_1812_EXPECTED_TYPE_NAME_AFTER_DOT_IN_DROP_TYPE: {
		code: 1812,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	EXPECTED_ADD_IN_ALTER_TYPE: {
		code: 1813,
		msg: ["Expected `add` in ALTER TYPE"],
	},
	EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE: {
		code: 1814,
		msg: ["Expected `value` after `ADD` in ALTER TYPE"],
	},
	EXPECTED_NOT_AFTER_IF_IN_CREATE_TYPE: {
		code: 1815,
		msg: ["Expected `not` after `IF` in CREATE TYPE"],
	},
	EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TYPE: {
		code: 1816,
		msg: ["Expected `exists` after `IF NOT` in CREATE TYPE"],
	},
	EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE: {
		code: 1817,
		msg: ["Expected `exists` after `IF` in DROP TYPE"],
	},

	// Statement Validation
	INVALID_ALTER_TABLE_NAME: {
		code: 2107,
		msg: ["Invalid ALTER TABLE name"],
	},
	INVALID_CREATE_TABLE_NAME_PARSE: {
		code: 2108,
		msg: ["Invalid CREATE TABLE name parse"],
	},
	INVALID_DROP_TABLE_PARSE: {
		code: 2109,
		msg: ["Invalid DROP TABLE parse"],
	},
	INVALID_CREATE_TYPE_NAME_PARSE: {
		code: 2110,
		msg: ["Invalid CREATE TYPE name parse"],
	},
	INVALID_ALTER_TYPE_PARSE: {
		code: 2111,
		msg: ["Invalid ALTER TYPE parse"],
	},
	INVALID_DROP_TYPE_PARSE: {
		code: 2112,
		msg: ["Invalid DROP TYPE parse"],
	},
	INVALID_NUMBER: {
		code: 2116,
		msg: ["Invalid number"],
	},
	INVALID_NUMBER_FOR_VARCHAR_LENGTH: {
		code: 2117,
		msg: ["Invalid number for VARCHAR length"],
	},
	INVALID_PRECISION_NUMBER: {
		code: 2118,
		msg: ["Invalid precision number"],
	},
	INVALID_SCALE_NUMBER: {
		code: 2119,
		msg: ["Invalid scale number"],
	},

	// Resolution Errors - Unknown X
	// Table/Schema Resolution
	// Group 1: UNKNOWN_TABLE_* consolidated (Phase 2)
	UNKNOWN_TABLE: {
		code: 2200,
		msg: ["Unknown table ", " in ", ""],
	},
	OBSOLETE_2201_UNKNOWN_TABLE_UPDATE: {
		code: 2201,
		msg: ["Use UNKNOWN_TABLE with context parameter"],
	},

	OBSOLETE_2203_UNKNOWN_TABLE_INSERT_INTO: {
		code: 2203,
		msg: ["Use UNKNOWN_TABLE with context parameter"],
	},
	OBSOLETE_2204_UNKNOWN_TABLE_DELETE_FROM: {
		code: 2204,
		msg: ["Use UNKNOWN_TABLE with context parameter"],
	},
	OBSOLETE_2205_UNKNOWN_TABLE_IN_DELETE_USING: {
		code: 2205,
		msg: ["Use UNKNOWN_TABLE with context parameter"],
	},

	// Group 2: UNKNOWN_SCHEMA_OR_TABLE_* consolidated (Phase 2)
	UNKNOWN_SCHEMA_OR_TABLE: {
		code: 2207,
		msg: ["Unknown schema or table ", " in ", ""],
	},
	OBSOLETE_2208_UNKNOWN_SCHEMA_OR_TABLE_IN_FROM: {
		code: 2208,
		msg: ["Use UNKNOWN_SCHEMA_OR_TABLE with context parameter"],
	},
	OBSOLETE_2209_UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE: {
		code: 2209,
		msg: ["Use UNKNOWN_SCHEMA_OR_TABLE with context parameter"],
	},

	OBSOLETE_2211_UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO: {
		code: 2211,
		msg: ["Use UNKNOWN_SCHEMA_OR_TABLE with context parameter"],
	},
	OBSOLETE_2212_UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM: {
		code: 2212,
		msg: ["Use UNKNOWN_SCHEMA_OR_TABLE with context parameter"],
	},
	OBSOLETE_2213_UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING: {
		code: 2213,
		msg: ["Use UNKNOWN_SCHEMA_OR_TABLE with context parameter"],
	},
	// Group 4: UNKNOWN_SCHEMA_FOR_* consolidated (Phase 2)
	UNKNOWN_SCHEMA: {
		code: 2214,
		msg: ["Unknown schema ", " for ", ""],
	},
	OBSOLETE_2215_UNKNOWN_SCHEMA_FOR_CREATE_TYPE: {
		code: 2215,
		msg: ["Use UNKNOWN_SCHEMA with context parameter"],
	},
	OBSOLETE_2216_UNKNOWN_SCHEMA_FOR_CREATE_VIEW: {
		code: 2216,
		msg: ["Use UNKNOWN_SCHEMA with context parameter"],
	},

	// Column Resolution
	// Group 3: UNKNOWN_COLUMN_* consolidated (Phase 2)
	UNKNOWN_COLUMN: {
		code: 2300,
		msg: ["Unknown column ", " in ", ""],
	},
	OBSOLETE_2301_UNKNOWN_COLUMN_UPDATE_SET: {
		code: 2301,
		msg: ["Use UNKNOWN_COLUMN with context parameter"],
	},

	OBSOLETE_2303_UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST: {
		code: 2303,
		msg: ["Use UNKNOWN_COLUMN with context parameter"],
	},
	OBSOLETE_2304_UNKNOWN_COLUMN_IN_ON_CONFLICT: {
		code: 2304,
		msg: ["Use UNKNOWN_COLUMN with context parameter"],
	},
	OBSOLETE_2305_UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET: {
		code: 2305,
		msg: ["Use UNKNOWN_COLUMN with context parameter"],
	},
	UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN: {
		code: 2306,
		msg: ["Unknown column ", ".", ".", ""],
	},
	UNKNOWN_QUALIFIED_COLUMN: {
		code: 2307,
		msg: ["Unknown qualified column ", ".", ""],
	},
	UNKNOWN_ALIAS_IN_SELECT_STAR: {
		code: 2308,
		msg: ["Unknown alias in SELECT ... *"],
	},

	// Other Resolution
	UNKNOWN_QUERY_PARAMETER: {
		code: 2400,
		msg: ["Unknown query parameter: ", ""],
	},
	"<deleted>2401": {
		code: 2401,
		msg: [""],
	},
	UNKNOWN_WINDOW_FUNCTION: {
		code: 2402,
		msg: ["Unknown window function"],
	},
	POSITIONAL_PARAMETER_REQUIRES_ARRAY: {
		code: 2403,
		msg: ["Positional parameter (?) requires array parameters, not named parameters"],
	},
	POSITIONAL_PARAMETER_OUT_OF_BOUNDS: {
		code: 2404,
		msg: ["Positional parameter index ", " is out of bounds"],
	},

	// Type System Errors
	// Type Compatibility
	INCOMPATIBLE_TYPES_IN_COMPARISON: {
		code: 2500,
		msg: ["Incompatible types in comparison"],
	},
	INCOMPATIBLE_TYPES_IN_ARITHMETIC: {
		code: 2501,
		msg: ["Incompatible types in arithmetic"],
	},
	INCOMPATIBLE_TYPES_IN_CASE: {
		code: 2502,
		msg: ["Incompatible types in CASE"],
	},
	INCOMPATIBLE_TYPES_IN_BETWEEN: {
		code: 2503,
		msg: ["Incompatible types in BETWEEN"],
	},
	INCOMPATIBLE_TYPES_IN_IN_LIST: {
		code: 2504,
		msg: ["Incompatible types in IN list"],
	},
	INCOMPATIBLE_TYPES_IN_IN_SUBQUERY: {
		code: 2505,
		msg: ["Incompatible types in IN subquery"],
	},
	INCOMPATIBLE_TYPES_IN_JOIN_ON: {
		code: 2506,
		msg: ["Incompatible types in JOIN ON"],
	},
	INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN: {
		code: 2507,
		msg: ["Incompatible value type for column ", ""],
	},
	INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN: {
		code: 2508,
		msg: ["INSERT...SELECT type mismatch for column ", ""],
	},

	// Boolean Type Errors
	EXPRESSION_MUST_BE_BOOLEAN: {
		code: 2600,
		msg: ["Expression must be boolean, but has a type ", "."],
	},
	CASE_WHEN_MUST_BE_BOOLEAN: {
		code: 2601,
		msg: ["CASE WHEN must be boolean"],
	},
	NOT_REQUIRES_BOOLEAN_OPERAND: {
		code: 2602,
		msg: ["NOT requires a boolean operand"],
	},
	NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL: {
		code: 2603,
		msg: ["NOT argument must be boolean, not NULL"],
	},
	AND_OPERANDS_MUST_BE_BOOLEAN: {
		code: 2604,
		msg: ["AND operands must be boolean"],
	},
	OR_OPERANDS_MUST_BE_BOOLEAN: {
		code: 2605,
		msg: ["OR operands must be boolean"],
	},
	NULL_NOT_VALID_BOOLEAN_OPERAND: {
		code: 2606,
		msg: ["NULL is not a valid boolean operand (use IS NULL)"],
	},

	// NULL Handling
	NULL_NOT_ALLOWED_NOT_NULL_COLUMN: {
		code: 2700,
		msg: ["NULL not allowed for NOT NULL column ", ""],
	},
	NULL_NOT_ALLOWED_ARITHMETIC: {
		code: 2701,
		msg: ["NULL not allowed in arithmetic"],
	},
	NULL_NOT_ALLOWED_IN_BETWEEN: {
		code: 2702,
		msg: ["NULL not allowed in BETWEEN"],
	},
	NULL_NOT_ALLOWED_IN_LIKE: {
		code: 2703,
		msg: ["NULL not allowed in LIKE"],
	},
	USE_IS_NULL_INSTEAD_OF_EQUALS_NULL: {
		code: 2704,
		msg: ["Use IS NULL instead of = null"],
	},

	// Text/String Operations
	CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND: {
		code: 2800,
		msg: ["|| requires at least one text operand"],
	},
	CANNOT_CONCATENATE_ARRAY_WITH_TEXT: {
		code: 2801,
		msg: ["Cannot concatenate array with text"],
	},
	CANNOT_CONCATENATE_TEXT_WITH_ARRAY: {
		code: 2802,
		msg: ["Cannot concatenate text with array"],
	},
	LIKE_LEFT_OPERAND_MUST_BE_TEXT: {
		code: 2803,
		msg: ["LIKE left operand must be text"],
	},
	CANNOT_CONCATENATE_TEXT_WITH_TYPE: {
		code: 2804,
		msg: ["Cannot concatenate text with ", ""],
	},
	CANNOT_CONCATENATE_TYPE_WITH_TEXT: {
		code: 2805,
		msg: ["Cannot concatenate ", " with text"],
	},
	LIKE_PATTERN_MUST_BE_TEXT: {
		code: 2806,
		msg: ["LIKE pattern must be text"],
	},
	FUNCTION_EXPECTS_TEXT_ARGUMENT: {
		code: 2807,
		msg: ["Function expects text argument"],
	},

	// Numeric Operations
	UNARY_MINUS_REQUIRES_A_NUMBER: {
		code: 2900,
		msg: ["Unary minus requires a number"],
	},

	// Array Operations
	CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY: {
		code: 3000,
		msg: ["Cannot determine type of empty array"],
	},
	ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY: {
		code: 3001,
		msg: ["ANY/ALL/SOME requires an array or subquery"],
	},

	// Subquery Type Errors
	SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN: {
		code: 3100,
		msg: ["Scalar subquery must project exactly one column"],
	},
	IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN: {
		code: 3101,
		msg: ["IN subquery must project exactly one column"],
	},
	SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED: {
		code: 3102,
		msg: ["Scalar subquery column inference failed"],
	},
	IN_SUBQUERY_COLUMN_INFERENCE_FAILED: {
		code: 3103,
		msg: ["IN subquery column inference failed"],
	},

	// Semantic/Constraint Errors
	// Duplicate/Existence Checks
	SCHEMA_ALREADY_EXISTS_USE_IF_NOT_EXISTS: {
		code: 3200,
		msg: ["Schema already exists; use IF NOT EXISTS"],
	},
	SCHEMA_DOES_NOT_EXIST_USE_IF_EXISTS: {
		code: 3201,
		msg: ["Schema does not exist; use IF EXISTS"],
	},
	TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS: {
		code: 3202,
		msg: ["Table already exists; use IF NOT EXISTS"],
	},
	TABLE_DOES_NOT_EXIST: {
		code: 3203,
		msg: ["Table does not exist"],
	},
	TABLE_DOES_NOT_EXIST_USE_IF_EXISTS: {
		code: 3204,
		msg: ["Table does not exist; use IF EXISTS"],
	},
	TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS: {
		code: 3205,
		msg: ["Type already exists; use IF NOT EXISTS"],
	},
	TYPE_DOES_NOT_EXIST_USE_IF_EXISTS: {
		code: 3206,
		msg: ["Type does not exist; use IF EXISTS"],
	},
	TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS: {
		code: 3207,
		msg: ["Type does not exist or is not an enum; use IF EXISTS"],
	},
	COLUMN_ALREADY_EXISTS: {
		code: 3208,
		msg: ["Column ", " already exists"],
	},
	COLUMN_DOES_NOT_EXIST: {
		code: 3209,
		msg: ["Column ", " does not exist"],
	},
	DUPLICATE_WITH_CLAUSE_NAME: {
		code: 3210,
		msg: ["Duplicate WITH clause name"],
	},
	VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA: {
		code: 3211,
		msg: ["View or table already exists in schema"],
	},

	// Constraint Violations
	MISSING_NOT_NULL_COLUMN_IN_INSERT: {
		code: 3300,
		msg: ["Missing NOT NULL column ", " in INSERT"],
	},
	INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY: {
		code: 3301,
		msg: ["INSERT column list must not be empty"],
	},
	ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY: {
		code: 3302,
		msg: ["ON CONFLICT column list must not be empty"],
	},
	IN_LIST_MUST_NOT_BE_EMPTY: {
		code: 3303,
		msg: ["IN list must not be empty"],
	},
	EMPTY_ENUM_VALUES_LIST_IN_CREATE_TYPE: {
		code: 3304,
		msg: ["Empty enum values list in CREATE TYPE"],
	},
	ENUM_VALUE_ALREADY_EXISTS: {
		code: 3305,
		msg: ["Enum value already exists"],
	},

	// SELECT Constraints
	SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST: {
		code: 3400,
		msg: ["SELECT * must be the only projection in the list"],
	},
	SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE: {
		code: 3401,
		msg: ["SELECT * requires a single FROM table"],
	},
	SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS: {
		code: 3402,
		msg: ["Scalar expression in SELECT requires AS alias"],
	},
	GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE: {
		code: 3403,
		msg: ["Grouped SELECT requires column to appear in GROUP BY or inside an aggregate"],
	},
	AMBIGUOUS_UNQUALIFIED_COLUMN: {
		code: 3404,
		msg: ["Ambiguous unqualified column ", ""],
	},
	QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS: {
		code: 3405,
		msg: ["Qualified table .* is only valid in SELECT lists"],
	},
	SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS: {
		code: 3406,
		msg: ["SELECT result column index out of bounds"],
	},
	SELECT_RESULT_MISSING_COLUMN: {
		code: 3407,
		msg: ["SELECT result missing column"],
	},

	// Statement Constraints
	INSERT_SELECT_COLUMN_COUNT_MISMATCH: {
		code: 3500,
		msg: ["INSERT...SELECT column count mismatch"],
	},
	STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT: {
		code: 3501,
		msg: ["stream() requires a row-returning statement (SELECT or RETURNING clause)"],
	},
	DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW: {
		code: 3502,
		msg: ["DROP TABLE targets a view; use DROP VIEW"],
	},
	ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES: {
		code: 3503,
		msg: ["ALTER TABLE applies only to base tables"],
	},
	TABLE_KEY_MISMATCH_IN_ALTER_TABLE: {
		code: 3504,
		msg: ["Table key mismatch in ALTER TABLE"],
	},
	COLUMN_RENAME_FAILED: {
		code: 3505,
		msg: ["Column rename failed"],
	},

	// Function Constraints
	THIS_FUNCTION_TAKES_NO_ARGUMENTS: {
		code: 3600,
		msg: ["This function takes no arguments"],
	},
	FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT: {
		code: 3601,
		msg: ["Function requires at least one argument"],
	},
	ROW_NUMBER_TAKES_NO_ARGUMENTS: {
		code: 3602,
		msg: ["ROW_NUMBER() takes no arguments"],
	},
	RANK_DENSE_RANK_TAKES_NO_ARGUMENTS: {
		code: 3603,
		msg: ["RANK/DENSE_RANK takes no arguments"],
	},
	NOW_TAKES_NO_ARGUMENTS: {
		code: 3604,
		msg: ["now() takes no arguments"],
	},
	LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT: {
		code: 3605,
		msg: ["LAG/LEAD requires at least 1 argument"],
	},
	INVALID_LAG_LEAD_ARGUMENTS: {
		code: 3606,
		msg: ["Invalid LAG/LEAD arguments"],
	},
	COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT: {
		code: 3607,
		msg: ["coalesce() requires at least one argument"],
	},
	SUM_REQUIRES_AN_ARGUMENT: {
		code: 3608,
		msg: ["sum() requires an argument"],
	},
	ARRAY_APPEND_REQUIRES_2_ARGUMENTS: {
		code: 3609,
		msg: ["array_append requires 2 arguments"],
	},
	ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT: {
		code: 3610,
		msg: ["array_append expects (array, element)"],
	},
	ARRAY_PREPEND_REQUIRES_2_ARGUMENTS: {
		code: 3611,
		msg: ["array_prepend requires 2 arguments"],
	},
	ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY: {
		code: 3612,
		msg: ["array_prepend expects (element, array)"],
	},
	ARRAY_LENGTH_REQUIRES_2_ARGUMENTS: {
		code: 3613,
		msg: ["array_length requires 2 arguments"],
	},
	ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER: {
		code: 3614,
		msg: ["array_length expects (array, integer)"],
	},
	UNNEST_REQUIRES_1_ARGUMENT: {
		code: 3615,
		msg: ["unnest requires 1 argument"],
	},
	UNNEST_EXPECTS_AN_ARRAY: {
		code: 3616,
		msg: ["unnest expects an array"],
	},
	QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED: {
		code: 3617,
		msg: ["Qualified function names are not supported"],
	},
	STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT: {
		code: 3618,
		msg: ["`*` is only allowed as COUNT(*) argument"],
	},
	UNKNOWN_FUNCTION: {
		code: 3619,
		msg: ["Unknown function: ", ""],
	},

	// DDL-Specific Errors
	// CREATE SCHEMA
	EXPECTED_SCHEMA_NAME_IN_CREATE_SCHEMA: {
		code: 3700,
		msg: ["Expected schema name in CREATE SCHEMA"],
	},
	OBSOLETE_3701_EXPECTED_SEMICOLON_AFTER_SCHEMA_NAME_IN_CREATE_SCHEMA: {
		code: 3701,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_NOT_AFTER_IF_IN_CREATE_SCHEMA: {
		code: 3702,
		msg: ["Expected `not` after `IF` in CREATE SCHEMA"],
	},
	EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_SCHEMA: {
		code: 3703,
		msg: ["Expected `exists` after `IF NOT` in CREATE SCHEMA"],
	},

	// DROP SCHEMA
	EXPECTED_SCHEMA_NAME_IN_DROP_SCHEMA: {
		code: 3800,
		msg: ["Expected schema name in DROP SCHEMA"],
	},
	OBSOLETE_3801_EXPECTED_SEMICOLON_AFTER_DROP_SCHEMA: {
		code: 3801,
		msg: ["Use EXPECTED_SEMICOLON with context parameter"],
	},
	EXPECTED_EXISTS_AFTER_IF_IN_DROP_SCHEMA: {
		code: 3802,
		msg: ["Expected `exists` after `IF` in DROP SCHEMA"],
	},

	// CREATE VIEW
	EXPECTED_VIEW_NAME_IN_CREATE_VIEW: {
		code: 3900,
		msg: ["Expected view name in CREATE VIEW"],
	},
	EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW: {
		code: 3901,
		msg: ["Expected view name after `.` in CREATE VIEW"],
	},
	EXPECTED_AS_IN_CREATE_VIEW: {
		code: 3902,
		msg: ["Expected AS in CREATE VIEW"],
	},
	EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME: {
		code: 3903,
		msg: ["Expected AS or `.` before view name"],
	},
	EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME: {
		code: 3904,
		msg: ["Expected AS after qualified view name"],
	},

	// ALTER TYPE
	EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE: {
		code: 4000,
		msg: ["Expected `exists` after `IF` in ALTER TYPE"],
	},
	EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE: {
		code: 4001,
		msg: ["Expected `.` or `ADD` in ALTER TYPE"],
	},
	EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE: {
		code: 4002,
		msg: ["Expected `.` or `;` after type name in DROP TYPE"],
	},

	// Misc DDL
	EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME: {
		code: 4100,
		msg: ["Expected `(` after qualified table name"],
	},
	EXPECTED_NAME: {
		code: 4101,
		msg: ["Expected name"],
	},
	EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME: {
		code: 4102,
		msg: ["Expected name after `.` in qualified name"],
	},
	EXPECTED_DOT_OR_KEYWORD_AFTER_NAME: {
		code: 4103,
		msg: ["Expected `.` or keyword after name"],
	},
	// Group 4: EXPECTED_TYPE_NAME (consolidated from 6 codes)
	OBSOLETE_4104_EXPECTED_TYPE_NAME_GENERIC: {
		code: 4104,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	EXPECTED_TYPE_NAME: {
		code: 4105,
		msg: ["Expected type name ", ""],
	},
	OBSOLETE_4106_EXPECTED_TYPE_NAME_AFTER_CAST_AS: {
		code: 4106,
		msg: ["Use EXPECTED_TYPE_NAME with context parameter"],
	},
	EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME: {
		code: 4107,
		msg: ["Expected `.` or `(` after table name"],
	},

	// DML/Expression-Specific Errors
	// JOIN Operations
	// Group 5: JOIN-related EXPECTED_* (consolidated from 9 codes to 2)
	EXPECTED_JOIN_KEYWORD: {
		code: 4200,
		msg: ["Expected JOIN after ", ""],
	},
	OBSOLETE_4201_EXPECTED_JOIN_AFTER_INNER: {
		code: 4201,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4202_EXPECTED_JOIN_AFTER_LEFT_OUTER: {
		code: 4202,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4203_EXPECTED_JOIN_AFTER_RIGHT_OUTER: {
		code: 4203,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4204_EXPECTED_JOIN_AFTER_FULL_OUTER: {
		code: 4204,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4205_EXPECTED_JOIN_KEYWORD_GENERIC: {
		code: 4205,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4206_EXPECTED_OUTER_OR_JOIN_AFTER_LEFT: {
		code: 4206,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4207_EXPECTED_OUTER_OR_JOIN_AFTER_RIGHT: {
		code: 4207,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	OBSOLETE_4208_EXPECTED_OUTER_OR_JOIN_AFTER_FULL: {
		code: 4208,
		msg: ["Use EXPECTED_JOIN_KEYWORD with context parameter"],
	},
	EXPECTED_ON_AFTER_JOIN_TABLE: {
		code: 4209,
		msg: ["Expected ON after JOIN table"],
	},
	EXPECTED_ON_KEYWORD: {
		code: 4210,
		msg: ["Expected ON keyword"],
	},

	// CASE Expression
	CASE_REQUIRES_AT_LEAST_ONE_WHEN: {
		code: 4300,
		msg: ["CASE requires at least one WHEN"],
	},
	EXPECTED_THEN_AFTER_CASE_WHEN: {
		code: 4301,
		msg: ["Expected THEN after CASE WHEN"],
	},

	// BETWEEN/IN Operations
	EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS: {
		code: 4400,
		msg: ["Expected AND between BETWEEN bounds"],
	},
	EXPECTED_OPEN_PAREN_AFTER_IN: {
		code: 4401,
		msg: ["Expected `(` after IN"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST: {
		code: 4402,
		msg: ["Expected `,` or `)` in IN list"],
	},

	// CAST Operations
	EXPECTED_OPEN_PAREN_AFTER_CAST: {
		code: 4500,
		msg: ["Expected `(` after CAST"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE: {
		code: 4501,
		msg: ["Expected `)` after CAST type"],
	},
	EXPECTED_AS_IN_CAST: {
		code: 4502,
		msg: ["Expected AS in CAST"],
	},
	CANNOT_CAST_BOOLEAN_TO_INTEGER: {
		code: 4503,
		msg: ["Cannot cast boolean to integer"],
	},
	CANNOT_CAST_INTEGER_TO_BOOLEAN: {
		code: 4504,
		msg: ["Cannot cast integer to boolean"],
	},

	// Window Functions
	EXPECTED_OPEN_PAREN_AFTER_OVER: {
		code: 4600,
		msg: ["Expected ( after OVER"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE: {
		code: 4601,
		msg: ["Expected ) after OVER clause"],
	},
	EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE: {
		code: 4602,
		msg: ["Expected PARTITION BY or ORDER BY in OVER clause"],
	},
	EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY: {
		code: 4603,
		msg: ["Expected ORDER BY or ) after PARTITION BY"],
	},

	// Array Operations
	EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT: {
		code: 4700,
		msg: ["Expected `]` after array subscript"],
	},
	EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR: {
		code: 4701,
		msg: ["Expected `,` or `]` in ARRAY constructor"],
	},
	EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE: {
		code: 4702,
		msg: ["Expected ] after [ in array type"],
	},

	// Operators
	EXPECTED_OPEN_PAREN_AFTER_OPERATOR: {
		code: 4800,
		msg: ["Expected `(` after OPERATOR"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN: {
		code: 4801,
		msg: ["Expected ) after OPERATOR("],
	},
	EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN: {
		code: 4802,
		msg: ["Expected operator after OPERATOR("],
	},
	EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME: {
		code: 4803,
		msg: ["Expected ( after ANY/ALL/SOME"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION: {
		code: 4804,
		msg: ["Expected ) after ANY/ALL/SOME expression"],
	},

	// EXISTS/Subquery
	EXPECTED_OPEN_PAREN_AFTER_EXISTS: {
		code: 4900,
		msg: ["Expected `(` after EXISTS"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY: {
		code: 4901,
		msg: ["Expected `)` after subquery"],
	},

	// Misc Expression
	EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST: {
		code: 5000,
		msg: ["Expected `,` or `)` in argument list"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT: {
		code: 5001,
		msg: ["Expected `)` after function name in DEFAULT"],
	},
	EXPECTED_NULL_AFTER_IS: {
		code: 5002,
		msg: ["Expected NULL after IS"],
	},
	EXPECTED_NULL_AFTER_IS_NOT: {
		code: 5003,
		msg: ["Expected NULL after IS NOT"],
	},
	EXPECTED_NULL_AFTER_DROP_NOT: {
		code: 5004,
		msg: ["Expected NULL after DROP NOT"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_STAR: {
		code: 5005,
		msg: ["Expected `)` after `*`"],
	},
	EXPECTED_CLOSE_PAREN: {
		code: 5006,
		msg: ["Expected `)`"],
	},
	UNSUPPORTED_PARENTHESIZED_EXPRESSION: {
		code: 5007,
		msg: ["Unsupported parenthesized expression"],
	},

	// Type/Data Specific Errors
	// VARCHAR/NUMERIC
	EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH: {
		code: 5100,
		msg: ["Expected ) after VARCHAR length"],
	},
	EXPECTED_NUMBER_FOR_VARCHAR_LENGTH: {
		code: 5101,
		msg: ["Expected number for VARCHAR length"],
	},
	EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE: {
		code: 5102,
		msg: ["Expected ) after NUMERIC scale"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION: {
		code: 5103,
		msg: ["Expected , or ) after NUMERIC precision"],
	},
	EXPECTED_PRECISION_NUMBER: {
		code: 5104,
		msg: ["Expected precision number"],
	},
	EXPECTED_SCALE_NUMBER: {
		code: 5105,
		msg: ["Expected scale number"],
	},

	// DEFAULT Values
	DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_BOOLEAN: {
		code: 5200,
		msg: ["DEFAULT value type mismatch: expected boolean column for boolean literal"],
	},
	DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_NUMERIC: {
		code: 5201,
		msg: ["DEFAULT value type mismatch: expected numeric column for numeric literal"],
	},
	DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_TEXT_UUID: {
		code: 5202,
		msg: ["DEFAULT value type mismatch: expected text/uuid column for string literal"],
	},
	DEFAULT_VALUE_TYPE_MISMATCH_NOW_REQUIRES_TIMESTAMP_COLUMN: {
		code: 5203,
		msg: ["DEFAULT value type mismatch: now() requires timestamp column"],
	},
	DEFAULT_VALUE_TYPE_MISMATCH_UUID_FUNCTION_REQUIRES_UUID_COLUMN: {
		code: 5204,
		msg: ["DEFAULT value type mismatch: UUID function requires uuid column"],
	},

	// FETCH/LIMIT
	EXPECTED_FIRST_OR_NEXT_AFTER_FETCH: {
		code: 5300,
		msg: ["Expected FIRST or NEXT after FETCH"],
	},
	EXPECTED_ROW_OR_ROWS_IN_FETCH: {
		code: 5301,
		msg: ["Expected ROW or ROWS in FETCH"],
	},
	EXPECTED_ONLY_AFTER_FETCH_ROW: {
		code: 5302,
		msg: ["Expected ONLY after FETCH … ROW"],
	},
	EXPECTED_ONLY_AFTER_FETCH_ROWS: {
		code: 5303,
		msg: ["Expected ONLY after FETCH … ROWS"],
	},

	// Misc
	EXPECTED_TO_IN_RENAME_COLUMN: {
		code: 5400,
		msg: ["Expected TO in RENAME COLUMN"],
	},
	EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN: {
		code: 5401,
		msg: ["Expected old column name in RENAME COLUMN"],
	},
	EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN: {
		code: 5402,
		msg: ["Expected new column name after TO in RENAME COLUMN"],
	},
	UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE: {
		code: 5403,
		msg: ["Unsupported ALTER COLUMN SET clause"],
	},
	UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE: {
		code: 5404,
		msg: ["Unsupported ALTER COLUMN DROP clause"],
	},
	UNSUPPORTED_ALTER_TABLE_ACTION: {
		code: 5405,
		msg: ["Unsupported ALTER TABLE action"],
	},
	UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY: {
		code: 5406,
		msg: ["Unexpected end in CREATE TYPE enum body"],
	},
	EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE: {
		code: 5407,
		msg: ["Expected `,` or `)` after DEFAULT value"],
	},
	EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET: {
		code: 5408,
		msg: ["Expected `,`, WHERE, or end after ON CONFLICT SET"],
	},
} as const satisfies Record<string, ErrorDescription>

type ErrorArgs<ED extends ErrorDescription> = Tuple<
	string | number,
	Dec[ED["msg"]["length"]] extends infer N extends TupleSize ? N : never
>

type JoinWithArgs<Msg extends readonly string[], Args extends (string | number)[]> = Msg extends readonly [
	infer First,
	...infer Rest,
]
	? First extends string
		? Rest extends readonly string[]
			? Args extends readonly [infer Arg, ...infer RestArgs]
				? Arg extends string | number
					? RestArgs extends (string | number)[]
						? Rest["length"] extends 0
							? `${First}${Arg}`
							: `${First}${Arg}${JoinWithArgs<Rest, RestArgs>}`
						: First
					: First
				: Rest["length"] extends 0
					? First
					: `${First}${JoinWithArgs<Rest, []>}`
			: never
		: never
	: ""

const duplicateCodes = Map.groupBy(Object.entries(errors), ([, e]) => e.code)
	.entries()
	.map(
		([code, entries]) =>
			entries.length > 1 && `Error codes ${entries.map(([id]) => id).join(", ")} have the same id "${code}"`,
	)
	.filter(Boolean)
	.toArray()
	.join("; ")

if (duplicateCodes) {
	throw new Error(duplicateCodes)
}
