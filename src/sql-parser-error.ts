import type { Dec, Tuple } from "./core/type-utils.ts"

type ErrorIds = keyof Errors

export type FormatError<
	ID extends ErrorIds,
	Args extends Tuple<string | number, Dec[Errors[ID]["msg"]["length"]]>,
> = Errors[ID] extends { code: infer Code extends keyof ErrorsConst; msg: infer Msg }
	? Msg extends readonly string[]
		? DbtyperError<Code, JoinWithArgs<Msg, Args>>
		: never
	: never

export type SqlParserError<Message extends string> = DbtyperError<-1, Message>

export type DbtyperError<Code extends -1 | keyof ErrorsConst, Message extends string> = {
	__sql_parser_error_code__: Code
	__sql_parser_error__: Message
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
	1001: {
		id: "UNCLOSED_QUOTED_IDENTIFIER",
		msg: ["Unclosed quoted identifier literal"],
	},
	1002: {
		id: "UNCLOSED_STRING_LITERAL",
		msg: ["Unclosed string literal"],
	},
	1003: {
		id: "UNCLOSED_TAGGED_STRING",
		msg: ["Unclosed tagged string"],
	},
	1004: {
		id: "WRONG_STRING_TAG",
		msg: ["Wrong string tag"],
	},
	1005: {
		id: "UNBALANCED_PARENTHESES",
		msg: ["Unbalanced parentheses"],
	},
	1006: {
		id: "TOKEN_NOT_FOUND",
		msg: ["Token not found"],
	},
	1007: {
		id: "UNEXPECTED_TOKEN",
		msg: ["Unexpected token"],
	},
	1008: {
		id: "CLOSING_BRACKET_NOT_FOUND",
		msg: ["Closing bracket not found: ", ""],
	},
	1009: {
		id: "UNMATCHED_CLOSING_BRACKET",
		msg: ["Unmatched closing bracket: ", ""],
	},

	// Parser Syntax Errors - Expected Keywords/Tokens
	// SELECT Statement
	1100: {
		id: "EXPECTED_SELECT_AFTER_WITH",
		msg: ["Expected SELECT after WITH clause"],
	},
	1101: {
		id: "EXPECTED_SELECT_IN_SUBQUERY",
		msg: ["Expected SELECT in subquery"],
	},
	1102: {
		id: "EXPECTED_SELECT_IN_DERIVED_TABLE",
		msg: ["Expected SELECT in derived table"],
	},
	1103: {
		id: "EXPECTED_SELECT_IN_EXISTS_SUBQUERY",
		msg: ["Expected SELECT in EXISTS subquery"],
	},
	1104: {
		id: "EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW",
		msg: ["Expected SELECT or WITH after AS in CREATE VIEW"],
	},
	1105: {
		id: "EXPECTED_SEMICOLON_AFTER_SELECT",
		msg: ["Expected semicolon after SELECT"],
	},
	1106: {
		id: "EXPECTED_FROM_AFTER_SELECT_LIST",
		msg: ["Expected FROM after SELECT list"],
	},
	1107: {
		id: "EXPECTED_BY_AFTER_GROUP",
		msg: ["Expected BY after GROUP"],
	},
	1108: {
		id: "EXPECTED_BY_AFTER_ORDER",
		msg: ["Expected BY after ORDER"],
	},
	1109: {
		id: "EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE",
		msg: ["Expected BY after ORDER in OVER clause"],
	},
	1110: {
		id: "EXPECTED_BY_AFTER_PARTITION",
		msg: ["Expected BY after PARTITION"],
	},
	1111: {
		id: "EXPECTED_CTE_NAME_IN_WITH",
		msg: ["Expected CTE name in WITH"],
	},
	1112: {
		id: "EXPECTED_ALIAS_AFTER_CTE",
		msg: ["Expected alias after CTE"],
	},
	1113: {
		id: "EXPECTED_ALIAS_AFTER_DERIVED_TABLE",
		msg: ["Expected alias after derived table"],
	},
	1114: {
		id: "EXPECTED_ALIAS_NAME_AFTER_AS",
		msg: ["Expected alias name after AS"],
	},
	1115: {
		id: "EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE",
		msg: ["Expected alias or join clause after table"],
	},
	1116: {
		id: "EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH",
		msg: ["Expected open paren after AS in WITH"],
	},
	1117: {
		id: "EXPECTED_END_AFTER_CASE",
		msg: ["Expected END after CASE"],
	},
	1118: {
		id: "EXPECTED_WHEN_AFTER_CASE_EXPRESSION",
		msg: ["Expected WHEN after CASE expression"],
	},
	1119: {
		id: "EXPECTED_WHEN_ELSE_OR_END_IN_CASE",
		msg: ["Expected WHEN ELSE or END in CASE"],
	},

	// INSERT Statement
	1200: {
		id: "EXPECTED_INTO_AFTER_INSERT",
		msg: ["Expected INTO after INSERT"],
	},
	1201: {
		id: "EXPECTED_SEMICOLON_AFTER_INSERT",
		msg: ["Expected `;` after INSERT"],
	},
	1202: {
		id: "EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT",
		msg: ["Expected `(` after VALUES in INSERT"],
	},
	1203: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES",
		msg: ["Expected `)` after INSERT values"],
	},
	1204: {
		id: "EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS",
		msg: ["Expected `(` after `,` between INSERT VALUES rows"],
	},
	1205: {
		id: "EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT",
		msg: ["Expected `(` (column list) after table in INSERT"],
	},
	1206: {
		id: "EXPECTED_COLUMN_NAME_IN_INSERT_COLUMN_LIST",
		msg: ["Expected column name in INSERT column list"],
	},
	1207: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST",
		msg: ["Expected `,` or `)` in INSERT column list"],
	},
	1208: {
		id: "EXPECTED_COMMA_BETWEEN_INSERT_VALUES",
		msg: ["Expected `,` between INSERT values"],
	},
	1209: {
		id: "EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT",
		msg: ["Expected VALUES or SELECT after column list in INSERT"],
	},
	1210: {
		id: "EXPECTED_CONFLICT_AFTER_ON_IN_INSERT",
		msg: ["Expected CONFLICT after ON in INSERT"],
	},
	1211: {
		id: "EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT",
		msg: ["Expected `(` after ON CONFLICT in INSERT"],
	},
	1212: {
		id: "EXPECTED_COLUMN_NAME_IN_ON_CONFLICT",
		msg: ["Expected column name in ON CONFLICT"],
	},
	1213: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST",
		msg: ["Expected `,` or `)` in ON CONFLICT column list"],
	},
	1214: {
		id: "EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT",
		msg: ["Expected DO after ON CONFLICT column list in INSERT"],
	},
	1215: {
		id: "EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT",
		msg: ["Expected DO after ON CONFLICT columns in INSERT"],
	},
	1216: {
		id: "EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT",
		msg: ["Expected UPDATE after DO in INSERT ON CONFLICT"],
	},
	1217: {
		id: "EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT",
		msg: ["Expected SET after UPDATE in INSERT ON CONFLICT"],
	},
	1218: {
		id: "EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE",
		msg: ["Expected column name in ON CONFLICT UPDATE"],
	},
	1219: {
		id: "EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE",
		msg: ["Expected `=` after column in ON CONFLICT UPDATE"],
	},

	// UPDATE Statement
	1300: {
		id: "EXPECTED_SET_IN_UPDATE",
		msg: ["Expected SET in UPDATE"],
	},
	1301: {
		id: "EXPECTED_SET_AFTER_TABLE_IN_UPDATE",
		msg: ["Expected SET after table in UPDATE"],
	},
	1302: {
		id: "EXPECTED_SEMICOLON_AFTER_UPDATE",
		msg: ["Expected `;` after UPDATE"],
	},
	1303: {
		id: "EXPECTED_COLUMN_NAME_IN_UPDATE_SET",
		msg: ["Expected column name in UPDATE SET"],
	},
	1304: {
		id: "EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET",
		msg: ["Expected `=` after column in UPDATE SET"],
	},
	1305: {
		id: "EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT",
		msg: ["Expected `,`, FROM, WHERE, or end after UPDATE assignment"],
	},
	1306: {
		id: "EXPECTED_TABLE_NAME_IN_UPDATE",
		msg: ["Expected table name in UPDATE"],
	},
	1307: {
		id: "EXPECTED_TABLE_NAME_IN_UPDATE_FROM",
		msg: ["Expected table name in UPDATE FROM"],
	},
	1308: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE",
		msg: ["Expected table name after `.` in UPDATE"],
	},

	// DELETE Statement
	1400: {
		id: "EXPECTED_FROM_AFTER_DELETE",
		msg: ["Expected FROM after DELETE"],
	},
	1401: {
		id: "EXPECTED_SEMICOLON_AFTER_DELETE",
		msg: ["Expected `;` after DELETE"],
	},
	1402: {
		id: "EXPECTED_TABLE_NAME_IN_DELETE_FROM",
		msg: ["Expected table name in DELETE FROM"],
	},
	1403: {
		id: "EXPECTED_TABLE_NAME_IN_DELETE_USING",
		msg: ["Expected table name in DELETE USING"],
	},
	1404: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM",
		msg: ["Expected table name after `.` in DELETE FROM"],
	},
	1405: {
		id: "EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM",
		msg: ["Expected alias or end of table in DELETE FROM"],
	},

	// CREATE TABLE
	1500: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_TABLE",
		msg: ["Expected `;` after CREATE TABLE"],
	},
	1501: {
		id: "EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE",
		msg: ["Expected `(` before column list in CREATE TABLE"],
	},
	1502: {
		id: "EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE",
		msg: ["Expected `)` before end of CREATE TABLE"],
	},
	1503: {
		id: "EXPECTED_COLUMN_NAME_IN_CREATE_TABLE",
		msg: ["Expected column name in CREATE TABLE"],
	},
	1504: {
		id: "EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE",
		msg: ["Expected column type in CREATE TABLE"],
	},
	1505: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION",
		msg: ["Expected `,` or `)` after column definition"],
	},
	1506: {
		id: "EXPECTED_TABLE_NAME_IN_CREATE_TABLE",
		msg: ["Expected table name in CREATE TABLE"],
	},
	1507: {
		id: "EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE",
		msg: ["Expected `not` after `IF` in CREATE TABLE"],
	},
	1508: {
		id: "EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE",
		msg: ["Expected `exists` after `IF NOT` in CREATE TABLE"],
	},
	1509: {
		id: "EXPECTED_DEFAULT_VALUE",
		msg: ["Expected DEFAULT value"],
	},

	// ALTER TABLE
	1600: {
		id: "EXPECTED_SEMICOLON_AFTER_ALTER_TABLE",
		msg: ["Expected `;` after ALTER TABLE"],
	},
	1601: {
		id: "EXPECTED_TABLE_AFTER_ALTER",
		msg: ["Expected TABLE after ALTER"],
	},
	1602: {
		id: "EXPECTED_TABLE_NAME_IN_ALTER_TABLE",
		msg: ["Expected table name in ALTER TABLE"],
	},
	1603: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE",
		msg: ["Expected table name after `.` in ALTER TABLE"],
	},
	1604: {
		id: "EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE",
		msg: ["Expected column name after ADD in ALTER TABLE"],
	},
	1605: {
		id: "EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN",
		msg: ["Expected column name after ALTER COLUMN"],
	},
	1606: {
		id: "EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN",
		msg: ["Expected column name after DROP COLUMN"],
	},
	1607: {
		id: "EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE",
		msg: ["Expected column type in ALTER TABLE"],
	},
	1608: {
		id: "EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN",
		msg: ["Expected TYPE, SET, or DROP after ALTER COLUMN"],
	},
	1609: {
		id: "EXPECTED_NULL_AFTER_SET_NOT",
		msg: ["Expected NULL after SET NOT"],
	},

	// DROP TABLE
	1700: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_TABLE",
		msg: ["Expected `;` after DROP TABLE"],
	},
	1701: {
		id: "EXPECTED_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected table name in DROP TABLE"],
	},
	1702: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE",
		msg: ["Expected `exists` after `IF` in DROP TABLE"],
	},
	1703: {
		id: "EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected `.` or end of table name in DROP TABLE"],
	},
	1704: {
		id: "EXPECTED_SEMICOLON_AFTER_QUALIFIED_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected `;` after qualified table name in DROP TABLE"],
	},

	// CREATE/ALTER/DROP TYPE
	1800: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_TYPE",
		msg: ["Expected `;` after CREATE TYPE"],
	},
	1801: {
		id: "EXPECTED_SEMICOLON_AFTER_ALTER_TYPE",
		msg: ["Expected `;` after ALTER TYPE"],
	},
	1802: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_TYPE",
		msg: ["Expected `;` after DROP TYPE"],
	},
	1803: {
		id: "EXPECTED_AS_AFTER_TYPE_NAME_IN_CREATE_TYPE",
		msg: ["Expected `as` after type name in CREATE TYPE"],
	},
	1804: {
		id: "EXPECTED_ENUM_AFTER_AS_IN_CREATE_TYPE",
		msg: ["Expected `enum` after `AS` in CREATE TYPE"],
	},
	1805: {
		id: "EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE",
		msg: ["Expected `(` before enum values in CREATE TYPE"],
	},
	1806: {
		id: "EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_CREATE_TYPE",
		msg: ["Expected string literal for enum value in CREATE TYPE"],
	},
	1807: {
		id: "EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE",
		msg: ["Expected string literal for enum value in ALTER TYPE"],
	},
	1808: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_ENUM_VALUE_IN_CREATE_TYPE",
		msg: ["Expected `,` or `)` after enum value in CREATE TYPE"],
	},
	1809: {
		id: "EXPECTED_TYPE_NAME_IN_ALTER_TYPE",
		msg: ["Expected type name in ALTER TYPE"],
	},
	1810: {
		id: "EXPECTED_TYPE_NAME_IN_DROP_TYPE",
		msg: ["Expected type name in DROP TYPE"],
	},
	1811: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE",
		msg: ["Expected type name after `.` in ALTER TYPE"],
	},
	1812: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOT_IN_DROP_TYPE",
		msg: ["Expected type name after `.` in DROP TYPE"],
	},
	1813: {
		id: "EXPECTED_ADD_IN_ALTER_TYPE",
		msg: ["Expected `add` in ALTER TYPE"],
	},
	1814: {
		id: "EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE",
		msg: ["Expected `value` after `ADD` in ALTER TYPE"],
	},
	1815: {
		id: "EXPECTED_NOT_AFTER_IF_IN_CREATE_TYPE",
		msg: ["Expected `not` after `IF` in CREATE TYPE"],
	},
	1816: {
		id: "EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TYPE",
		msg: ["Expected `exists` after `IF NOT` in CREATE TYPE"],
	},
	1817: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_DROP_TYPE",
		msg: ["Expected `exists` after `IF` in DROP TYPE"],
	},

	// Validation Errors - Invalid X
	// Expression Validation
	2000: {
		id: "INVALID_SCALAR_EXPRESSION",
		msg: ["Invalid scalar expression"],
	},
	2001: {
		id: "INVALID_COMPARISON_OPERAND",
		msg: ["Invalid comparison operand"],
	},
	2002: {
		id: "INVALID_COMPARISON_OPERATOR",
		msg: ["Invalid comparison operator"],
	},
	2003: {
		id: "INVALID_ARITHMETIC_OPERAND",
		msg: ["Invalid arithmetic operand"],
	},
	2004: {
		id: "INVALID_BETWEEN_OPERAND",
		msg: ["Invalid BETWEEN operand"],
	},
	2005: {
		id: "INVALID_BETWEEN_BOUND",
		msg: ["Invalid BETWEEN bound"],
	},
	2006: {
		id: "INVALID_LIKE_OPERAND",
		msg: ["Invalid LIKE operand"],
	},
	2007: {
		id: "INVALID_LIKE_PATTERN",
		msg: ["Invalid LIKE pattern"],
	},
	2008: {
		id: "INVALID_IS_NULL_OPERAND",
		msg: ["Invalid IS NULL operand"],
	},
	2009: {
		id: "INVALID_IS_NOT_NULL_OPERAND",
		msg: ["Invalid IS NOT NULL operand"],
	},
	2010: {
		id: "INVALID_CAST_OPERAND",
		msg: ["Invalid cast operand"],
	},
	2011: {
		id: "INVALID_CAST_TARGET",
		msg: ["Invalid cast target"],
	},
	2012: {
		id: "INVALID_COLUMN_REFERENCE",
		msg: ["Invalid column reference"],
	},
	2013: {
		id: "INVALID_CASE_EXPRESSION",
		msg: ["Invalid CASE expression"],
	},
	2014: {
		id: "INVALID_CASE_DISCRIMINANT",
		msg: ["Invalid CASE discriminant"],
	},
	2015: {
		id: "INVALID_CASE_BRANCH",
		msg: ["Invalid CASE branch"],
	},
	2016: {
		id: "INVALID_CASE_WHEN_VALUE",
		msg: ["Invalid CASE WHEN value"],
	},
	2017: {
		id: "INVALID_CASE_ELSE",
		msg: ["Invalid CASE ELSE"],
	},
	2018: {
		id: "INVALID_GROUP_BY_EXPRESSION",
		msg: ["Invalid GROUP BY expression"],
	},
	2019: {
		id: "INVALID_ORDER_BY_EXPRESSION",
		msg: ["Invalid ORDER BY expression"],
	},
	2020: {
		id: "INVALID_IN_LEFT_OPERAND",
		msg: ["Invalid IN left operand"],
	},
	2021: {
		id: "INVALID_IN_LIST_ELEMENT",
		msg: ["Invalid IN list element"],
	},
	2022: {
		id: "INVALID_IN_SUBQUERY_COLUMN",
		msg: ["Invalid IN subquery column"],
	},
	2023: {
		id: "INVALID_ANY_ALL_SOME_OPERAND",
		msg: ["Invalid ANY/ALL/SOME operand"],
	},
	2024: {
		id: "INVALID_ANY_ALL_SOME_LEFT_OPERAND",
		msg: ["Invalid ANY/ALL/SOME left operand"],
	},
	2025: {
		id: "INVALID_ANY_ALL_SOME_COMPARISON",
		msg: ["Invalid ANY/ALL/SOME comparison"],
	},
	2026: {
		id: "INVALID_ANY_ALL_SOME_SUBQUERY_COLUMN",
		msg: ["Invalid ANY/ALL/SOME subquery column"],
	},
	2027: {
		id: "INVALID_ARRAY_BASE_OPERAND",
		msg: ["Invalid array base operand"],
	},
	2028: {
		id: "INVALID_ARRAY_SUBSCRIPT_OPERAND",
		msg: ["Invalid array subscript operand"],
	},
	2029: {
		id: "INVALID_ARRAY_ELEMENT",
		msg: ["Invalid ARRAY element"],
	},

	// Statement Validation
	2100: {
		id: "INVALID_VALUE_EXPRESSION_IN_INSERT",
		msg: ["Invalid value expression in INSERT"],
	},
	2101: {
		id: "INVALID_VALUE_EXPRESSION_IN_UPDATE",
		msg: ["Invalid value expression in UPDATE"],
	},
	2102: {
		id: "INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE",
		msg: ["Invalid value expression in ON CONFLICT UPDATE"],
	},
	2103: {
		id: "INVALID_TABLE_IN_UPDATE_FROM",
		msg: ["Invalid table in UPDATE FROM"],
	},
	2104: {
		id: "INVALID_TABLE_IN_DELETE_USING",
		msg: ["Invalid table in DELETE USING"],
	},
	2105: {
		id: "INVALID_SUBQUERY_RESULT",
		msg: ["Invalid subquery result"],
	},
	2106: {
		id: "INVALID_PARAMETER_TYPE_IN_SELECT",
		msg: ["Invalid parameter type in SELECT"],
	},
	2107: {
		id: "INVALID_ALTER_TABLE_NAME",
		msg: ["Invalid ALTER TABLE name"],
	},
	2108: {
		id: "INVALID_CREATE_TABLE_NAME_PARSE",
		msg: ["Invalid CREATE TABLE name parse"],
	},
	2109: {
		id: "INVALID_DROP_TABLE_PARSE",
		msg: ["Invalid DROP TABLE parse"],
	},
	2110: {
		id: "INVALID_CREATE_TYPE_NAME_PARSE",
		msg: ["Invalid CREATE TYPE name parse"],
	},
	2111: {
		id: "INVALID_ALTER_TYPE_PARSE",
		msg: ["Invalid ALTER TYPE parse"],
	},
	2112: {
		id: "INVALID_DROP_TYPE_PARSE",
		msg: ["Invalid DROP TYPE parse"],
	},
	2113: {
		id: "INVALID_CUSTOM_OPERATOR_OPERAND",
		msg: ["Invalid custom operator operand"],
	},
	2114: {
		id: "INVALID_TILDE_OPERAND",
		msg: ["Invalid ~ operand"],
	},
	2115: {
		id: "INVALID_TILDE_PATTERN",
		msg: ["Invalid ~ pattern"],
	},
	2116: {
		id: "INVALID_NUMBER",
		msg: ["Invalid number"],
	},
	2117: {
		id: "INVALID_NUMBER_FOR_VARCHAR_LENGTH",
		msg: ["Invalid number for VARCHAR length"],
	},
	2118: {
		id: "INVALID_PRECISION_NUMBER",
		msg: ["Invalid precision number"],
	},
	2119: {
		id: "INVALID_SCALE_NUMBER",
		msg: ["Invalid scale number"],
	},

	// Resolution Errors - Unknown X
	// Table/Schema Resolution
	2200: {
		id: "UNKNOWN_TABLE_FROM",
		msg: ["Unknown table in FROM"],
	},
	2201: {
		id: "UNKNOWN_TABLE_UPDATE",
		msg: ["Unknown table ", " in UPDATE"],
	},
	2202: {
		id: "UNKNOWN_TABLE_IN_UPDATE_FROM",
		msg: ["Unknown table ", " in UPDATE FROM"],
	},
	2203: {
		id: "UNKNOWN_TABLE_INSERT_INTO",
		msg: ["Unknown table in INSERT INTO"],
	},
	2204: {
		id: "UNKNOWN_TABLE_DELETE_FROM",
		msg: ["Unknown table ", " in DELETE FROM"],
	},
	2205: {
		id: "UNKNOWN_TABLE_IN_DELETE_USING",
		msg: ["Unknown table ", " in DELETE USING"],
	},
	2206: {
		id: "UNKNOWN_TABLE_IN_SELECT_STAR",
		msg: ["Unknown table in SELECT ... *"],
	},
	2207: {
		id: "UNKNOWN_SCHEMA_OR_TABLE",
		msg: ["Unknown schema ", " or table ", ""],
	},
	2208: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_FROM",
		msg: ["Unknown schema or table in FROM"],
	},
	2209: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE",
		msg: ["Unknown schema ", " or table ", " in UPDATE"],
	},
	2210: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE_FROM",
		msg: ["Unknown schema ", " or table ", " in UPDATE FROM"],
	},
	2211: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO",
		msg: ["Unknown schema or table in INSERT INTO"],
	},
	2212: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM",
		msg: ["Unknown schema ", " or table ", " in DELETE FROM"],
	},
	2213: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING",
		msg: ["Unknown schema ", " or table ", " in DELETE USING"],
	},
	2214: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_TABLE",
		msg: ["Unknown schema ", " for CREATE TABLE"],
	},
	2215: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_TYPE",
		msg: ["Unknown schema ", " for CREATE TYPE"],
	},
	2216: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_VIEW",
		msg: ["Unknown schema ", " for CREATE VIEW"],
	},

	// Column Resolution
	2300: {
		id: "UNKNOWN_COLUMN",
		msg: ["Unknown column ", ""],
	},
	2301: {
		id: "UNKNOWN_COLUMN_UPDATE_SET",
		msg: ["Unknown column ", " in UPDATE SET"],
	},
	2302: {
		id: "UNKNOWN_COLUMN_INSERT",
		msg: ["Unknown column ", " in INSERT"],
	},
	2303: {
		id: "UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST",
		msg: ["Unknown column in INSERT column list"],
	},
	2304: {
		id: "UNKNOWN_COLUMN_IN_ON_CONFLICT",
		msg: ["Unknown column in ON CONFLICT"],
	},
	2305: {
		id: "UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET",
		msg: ["Unknown column in ON CONFLICT DO UPDATE SET"],
	},
	2306: {
		id: "UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN",
		msg: ["Unknown column ", ".", ".", ""],
	},
	2307: {
		id: "UNKNOWN_QUALIFIED_COLUMN",
		msg: ["Unknown qualified column ", ".", ""],
	},
	2308: {
		id: "UNKNOWN_ALIAS_IN_SELECT_STAR",
		msg: ["Unknown alias in SELECT ... *"],
	},

	// Other Resolution
	2400: {
		id: "UNKNOWN_QUERY_PARAMETER",
		msg: ["Unknown query parameter"],
	},
	2401: {
		id: "UNKNOWN_QUERY_PARAMETER_IN_SELECT",
		msg: ["Unknown query parameter in SELECT"],
	},
	2402: {
		id: "UNKNOWN_WINDOW_FUNCTION",
		msg: ["Unknown window function"],
	},

	// Type System Errors
	// Type Compatibility
	2500: {
		id: "INCOMPATIBLE_TYPES_IN_COMPARISON",
		msg: ["Incompatible types in comparison"],
	},
	2501: {
		id: "INCOMPATIBLE_TYPES_IN_ARITHMETIC",
		msg: ["Incompatible types in arithmetic"],
	},
	2502: {
		id: "INCOMPATIBLE_TYPES_IN_CASE",
		msg: ["Incompatible types in CASE"],
	},
	2503: {
		id: "INCOMPATIBLE_TYPES_IN_BETWEEN",
		msg: ["Incompatible types in BETWEEN"],
	},
	2504: {
		id: "INCOMPATIBLE_TYPES_IN_IN_LIST",
		msg: ["Incompatible types in IN list"],
	},
	2505: {
		id: "INCOMPATIBLE_TYPES_IN_IN_SUBQUERY",
		msg: ["Incompatible types in IN subquery"],
	},
	2506: {
		id: "INCOMPATIBLE_TYPES_IN_JOIN_ON",
		msg: ["Incompatible types in JOIN ON"],
	},
	2507: {
		id: "INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN",
		msg: ["Incompatible value type for column ", ""],
	},
	2508: {
		id: "INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN",
		msg: ["INSERT...SELECT type mismatch for column"],
	},

	// Boolean Type Errors
	2600: {
		id: "EXPRESSION_MUST_BE_BOOLEAN",
		msg: ["Expression must be boolean, but has a type ", "."],
	},
	2601: {
		id: "CASE_WHEN_MUST_BE_BOOLEAN",
		msg: ["CASE WHEN must be boolean"],
	},
	2602: {
		id: "NOT_REQUIRES_BOOLEAN_OPERAND",
		msg: ["NOT requires a boolean operand"],
	},
	2603: {
		id: "NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL",
		msg: ["NOT argument must be boolean, not NULL"],
	},
	2604: {
		id: "AND_OPERANDS_MUST_BE_BOOLEAN",
		msg: ["AND operands must be boolean"],
	},
	2605: {
		id: "OR_OPERANDS_MUST_BE_BOOLEAN",
		msg: ["OR operands must be boolean"],
	},
	2606: {
		id: "NULL_NOT_VALID_BOOLEAN_OPERAND",
		msg: ["NULL is not a valid boolean operand (use IS NULL)"],
	},

	// NULL Handling
	2700: {
		id: "NULL_NOT_ALLOWED_NOT_NULL_COLUMN",
		msg: ["NULL not allowed for NOT NULL column ", ""],
	},
	2701: {
		id: "NULL_NOT_ALLOWED_ARITHMETIC",
		msg: ["NULL not allowed in arithmetic"],
	},
	2702: {
		id: "NULL_NOT_ALLOWED_IN_BETWEEN",
		msg: ["NULL not allowed in BETWEEN"],
	},
	2703: {
		id: "NULL_NOT_ALLOWED_IN_LIKE",
		msg: ["NULL not allowed in LIKE"],
	},
	2704: {
		id: "USE_IS_NULL_INSTEAD_OF_EQUALS_NULL",
		msg: ["Use IS NULL instead of = null"],
	},

	// Text/String Operations
	2800: {
		id: "CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND",
		msg: ["|| requires at least one text operand"],
	},
	2801: {
		id: "CANNOT_CONCATENATE_ARRAY_WITH_TEXT",
		msg: ["Cannot concatenate array with text"],
	},
	2802: {
		id: "CANNOT_CONCATENATE_TEXT_WITH_ARRAY",
		msg: ["Cannot concatenate text with array"],
	},
	2803: {
		id: "LIKE_LEFT_OPERAND_MUST_BE_TEXT",
		msg: ["LIKE left operand must be text"],
	},
	2804: {
		id: "LIKE_PATTERN_MUST_BE_TEXT",
		msg: ["LIKE pattern must be text"],
	},
	2805: {
		id: "FUNCTION_EXPECTS_TEXT_ARGUMENT",
		msg: ["Function expects text argument"],
	},

	// Numeric Operations
	2900: {
		id: "UNARY_MINUS_REQUIRES_A_NUMBER",
		msg: ["Unary minus requires a number"],
	},

	// Array Operations
	3000: {
		id: "CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY",
		msg: ["Cannot determine type of empty array"],
	},
	3001: {
		id: "ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY",
		msg: ["ANY/ALL/SOME requires an array or subquery"],
	},

	// Subquery Type Errors
	3100: {
		id: "SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN",
		msg: ["Scalar subquery must project exactly one column"],
	},
	3101: {
		id: "IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN",
		msg: ["IN subquery must project exactly one column"],
	},
	3102: {
		id: "SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED",
		msg: ["Scalar subquery column inference failed"],
	},
	3103: {
		id: "IN_SUBQUERY_COLUMN_INFERENCE_FAILED",
		msg: ["IN subquery column inference failed"],
	},

	// Semantic/Constraint Errors
	// Duplicate/Existence Checks
	3200: {
		id: "SCHEMA_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Schema already exists; use IF NOT EXISTS"],
	},
	3201: {
		id: "SCHEMA_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Schema does not exist; use IF EXISTS"],
	},
	3202: {
		id: "TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Table already exists; use IF NOT EXISTS"],
	},
	3203: {
		id: "TABLE_DOES_NOT_EXIST",
		msg: ["Table does not exist"],
	},
	3204: {
		id: "TABLE_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Table does not exist; use IF EXISTS"],
	},
	3205: {
		id: "TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Type already exists; use IF NOT EXISTS"],
	},
	3206: {
		id: "TYPE_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Type does not exist; use IF EXISTS"],
	},
	3207: {
		id: "TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS",
		msg: ["Type does not exist or is not an enum; use IF EXISTS"],
	},
	3208: {
		id: "COLUMN_ALREADY_EXISTS",
		msg: ["Column ", " already exists"],
	},
	3209: {
		id: "COLUMN_DOES_NOT_EXIST",
		msg: ["Column ", " does not exist"],
	},
	3210: {
		id: "DUPLICATE_WITH_CLAUSE_NAME",
		msg: ["Duplicate WITH clause name"],
	},
	3211: {
		id: "VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA",
		msg: ["View or table already exists in schema"],
	},

	// Constraint Violations
	3300: {
		id: "MISSING_NOT_NULL_COLUMN_IN_INSERT",
		msg: ["Missing NOT NULL column in INSERT"],
	},
	3301: {
		id: "INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["INSERT column list must not be empty"],
	},
	3302: {
		id: "ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["ON CONFLICT column list must not be empty"],
	},
	3303: {
		id: "IN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["IN list must not be empty"],
	},
	3304: {
		id: "EMPTY_ENUM_VALUES_LIST_IN_CREATE_TYPE",
		msg: ["Empty enum values list in CREATE TYPE"],
	},
	3305: {
		id: "ENUM_VALUE_ALREADY_EXISTS",
		msg: ["Enum value already exists"],
	},

	// SELECT Constraints
	3400: {
		id: "SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST",
		msg: ["SELECT * must be the only projection in the list"],
	},
	3401: {
		id: "SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE",
		msg: ["SELECT * requires a single FROM table"],
	},
	3402: {
		id: "SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS",
		msg: ["Scalar expression in SELECT requires AS alias"],
	},
	3403: {
		id: "GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE",
		msg: ["Grouped SELECT requires column to appear in GROUP BY or inside an aggregate"],
	},
	3404: {
		id: "AMBIGUOUS_UNQUALIFIED_COLUMN",
		msg: ["Ambiguous unqualified column ", ""],
	},
	3405: {
		id: "QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS",
		msg: ["Qualified table .* is only valid in SELECT lists"],
	},
	3406: {
		id: "SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS",
		msg: ["SELECT result column index out of bounds"],
	},
	3407: {
		id: "SELECT_RESULT_MISSING_COLUMN",
		msg: ["SELECT result missing column"],
	},

	// Statement Constraints
	3500: {
		id: "INSERT_SELECT_COLUMN_COUNT_MISMATCH",
		msg: ["INSERT...SELECT column count mismatch"],
	},
	3501: {
		id: "STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT",
		msg: ["stream() requires a row-returning statement (SELECT or RETURNING clause)"],
	},
	3502: {
		id: "DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW",
		msg: ["DROP TABLE targets a view; use DROP VIEW"],
	},
	3503: {
		id: "ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES",
		msg: ["ALTER TABLE applies only to base tables"],
	},
	3504: {
		id: "TABLE_KEY_MISMATCH_IN_ALTER_TABLE",
		msg: ["Table key mismatch in ALTER TABLE"],
	},
	3505: {
		id: "COLUMN_RENAME_FAILED",
		msg: ["Column rename failed"],
	},

	// Function Constraints
	3600: {
		id: "THIS_FUNCTION_TAKES_NO_ARGUMENTS",
		msg: ["This function takes no arguments"],
	},
	3601: {
		id: "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT",
		msg: ["Function requires at least one argument"],
	},
	3602: {
		id: "ROW_NUMBER_TAKES_NO_ARGUMENTS",
		msg: ["ROW_NUMBER() takes no arguments"],
	},
	3603: {
		id: "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS",
		msg: ["RANK/DENSE_RANK takes no arguments"],
	},
	3604: {
		id: "NOW_TAKES_NO_ARGUMENTS",
		msg: ["now() takes no arguments"],
	},
	3605: {
		id: "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT",
		msg: ["LAG/LEAD requires at least 1 argument"],
	},
	3606: {
		id: "INVALID_LAG_LEAD_ARGUMENTS",
		msg: ["Invalid LAG/LEAD arguments"],
	},
	3607: {
		id: "COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT",
		msg: ["coalesce() requires at least one argument"],
	},
	3608: {
		id: "SUM_REQUIRES_AN_ARGUMENT",
		msg: ["sum() requires an argument"],
	},
	3609: {
		id: "ARRAY_APPEND_REQUIRES_2_ARGUMENTS",
		msg: ["array_append requires 2 arguments"],
	},
	3610: {
		id: "ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT",
		msg: ["array_append expects (array, element)"],
	},
	3611: {
		id: "ARRAY_PREPEND_REQUIRES_2_ARGUMENTS",
		msg: ["array_prepend requires 2 arguments"],
	},
	3612: {
		id: "ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY",
		msg: ["array_prepend expects (element, array)"],
	},
	3613: {
		id: "ARRAY_LENGTH_REQUIRES_2_ARGUMENTS",
		msg: ["array_length requires 2 arguments"],
	},
	3614: {
		id: "ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER",
		msg: ["array_length expects (array, integer)"],
	},
	3615: {
		id: "UNNEST_REQUIRES_1_ARGUMENT",
		msg: ["unnest requires 1 argument"],
	},
	3616: {
		id: "UNNEST_EXPECTS_AN_ARRAY",
		msg: ["unnest expects an array"],
	},
	3617: {
		id: "QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED",
		msg: ["Qualified function names are not supported"],
	},
	3618: {
		id: "STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT",
		msg: ["`*` is only allowed as COUNT(*) argument"],
	},

	// DDL-Specific Errors
	// CREATE SCHEMA
	3700: {
		id: "EXPECTED_SCHEMA_NAME_IN_CREATE_SCHEMA",
		msg: ["Expected schema name in CREATE SCHEMA"],
	},
	3701: {
		id: "EXPECTED_SEMICOLON_AFTER_SCHEMA_NAME_IN_CREATE_SCHEMA",
		msg: ["Expected `;` after schema name in CREATE SCHEMA"],
	},
	3702: {
		id: "EXPECTED_NOT_AFTER_IF_IN_CREATE_SCHEMA",
		msg: ["Expected `not` after `IF` in CREATE SCHEMA"],
	},
	3703: {
		id: "EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_SCHEMA",
		msg: ["Expected `exists` after `IF NOT` in CREATE SCHEMA"],
	},

	// DROP SCHEMA
	3800: {
		id: "EXPECTED_SCHEMA_NAME_IN_DROP_SCHEMA",
		msg: ["Expected schema name in DROP SCHEMA"],
	},
	3801: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_SCHEMA",
		msg: ["Expected `;` after DROP SCHEMA"],
	},
	3802: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_DROP_SCHEMA",
		msg: ["Expected `exists` after `IF` in DROP SCHEMA"],
	},

	// CREATE VIEW
	3900: {
		id: "EXPECTED_VIEW_NAME_IN_CREATE_VIEW",
		msg: ["Expected view name in CREATE VIEW"],
	},
	3901: {
		id: "EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW",
		msg: ["Expected view name after `.` in CREATE VIEW"],
	},
	3902: {
		id: "EXPECTED_AS_IN_CREATE_VIEW",
		msg: ["Expected AS in CREATE VIEW"],
	},
	3903: {
		id: "EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME",
		msg: ["Expected AS or `.` before view name"],
	},
	3904: {
		id: "EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME",
		msg: ["Expected AS after qualified view name"],
	},
	3905: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_VIEW",
		msg: ["Expected semicolon after CREATE VIEW"],
	},

	// ALTER TYPE
	4000: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE",
		msg: ["Expected `exists` after `IF` in ALTER TYPE"],
	},
	4001: {
		id: "EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE",
		msg: ["Expected `.` or `ADD` in ALTER TYPE"],
	},
	4002: {
		id: "EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE",
		msg: ["Expected `.` or `;` after type name in DROP TYPE"],
	},

	// Misc DDL
	4100: {
		id: "EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME",
		msg: ["Expected `(` after qualified table name"],
	},
	4101: {
		id: "EXPECTED_NAME",
		msg: ["Expected name"],
	},
	4102: {
		id: "EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME",
		msg: ["Expected name after `.` in qualified name"],
	},
	4103: {
		id: "EXPECTED_DOT_OR_KEYWORD_AFTER_NAME",
		msg: ["Expected `.` or keyword after name"],
	},
	4104: {
		id: "EXPECTED_TYPE_NAME",
		msg: ["Expected type name"],
	},
	4105: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOUBLE_COLON",
		msg: ["Expected type name after ::"],
	},
	4106: {
		id: "EXPECTED_TYPE_NAME_AFTER_CAST_AS",
		msg: ["Expected type name after CAST ... AS"],
	},
	4107: {
		id: "EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME",
		msg: ["Expected `.` or `(` after table name"],
	},

	// DML/Expression-Specific Errors
	// JOIN Operations
	4200: {
		id: "EXPECTED_JOIN_AFTER_CROSS",
		msg: ["Expected JOIN after CROSS"],
	},
	4201: {
		id: "EXPECTED_JOIN_AFTER_INNER",
		msg: ["Expected JOIN after INNER"],
	},
	4202: {
		id: "EXPECTED_JOIN_AFTER_LEFT_OUTER",
		msg: ["Expected JOIN after LEFT OUTER"],
	},
	4203: {
		id: "EXPECTED_JOIN_AFTER_RIGHT_OUTER",
		msg: ["Expected JOIN after RIGHT OUTER"],
	},
	4204: {
		id: "EXPECTED_JOIN_AFTER_FULL_OUTER",
		msg: ["Expected JOIN after FULL OUTER"],
	},
	4205: {
		id: "EXPECTED_JOIN_KEYWORD",
		msg: ["Expected JOIN keyword"],
	},
	4206: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_LEFT",
		msg: ["Expected OUTER or JOIN after LEFT"],
	},
	4207: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_RIGHT",
		msg: ["Expected OUTER or JOIN after RIGHT"],
	},
	4208: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_FULL",
		msg: ["Expected OUTER or JOIN after FULL"],
	},
	4209: {
		id: "EXPECTED_ON_AFTER_JOIN_TABLE",
		msg: ["Expected ON after JOIN table"],
	},
	4210: {
		id: "EXPECTED_ON_KEYWORD",
		msg: ["Expected ON keyword"],
	},

	// CASE Expression
	4300: {
		id: "CASE_REQUIRES_AT_LEAST_ONE_WHEN",
		msg: ["CASE requires at least one WHEN"],
	},
	4301: {
		id: "EXPECTED_THEN_AFTER_CASE_WHEN",
		msg: ["Expected THEN after CASE WHEN"],
	},

	// BETWEEN/IN Operations
	4400: {
		id: "EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS",
		msg: ["Expected AND between BETWEEN bounds"],
	},
	4401: {
		id: "EXPECTED_OPEN_PAREN_AFTER_IN",
		msg: ["Expected `(` after IN"],
	},
	4402: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST",
		msg: ["Expected `,` or `)` in IN list"],
	},

	// CAST Operations
	4500: {
		id: "EXPECTED_OPEN_PAREN_AFTER_CAST",
		msg: ["Expected `(` after CAST"],
	},
	4501: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE",
		msg: ["Expected `)` after CAST type"],
	},
	4502: {
		id: "EXPECTED_AS_IN_CAST",
		msg: ["Expected AS in CAST"],
	},

	// Window Functions
	4600: {
		id: "EXPECTED_OPEN_PAREN_AFTER_OVER",
		msg: ["Expected ( after OVER"],
	},
	4601: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE",
		msg: ["Expected ) after OVER clause"],
	},
	4602: {
		id: "EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE",
		msg: ["Expected PARTITION BY or ORDER BY in OVER clause"],
	},
	4603: {
		id: "EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY",
		msg: ["Expected ORDER BY or ) after PARTITION BY"],
	},

	// Array Operations
	4700: {
		id: "EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT",
		msg: ["Expected `]` after array subscript"],
	},
	4701: {
		id: "EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR",
		msg: ["Expected `,` or `]` in ARRAY constructor"],
	},
	4702: {
		id: "EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE",
		msg: ["Expected ] after [ in array type"],
	},

	// Operators
	4800: {
		id: "EXPECTED_OPEN_PAREN_AFTER_OPERATOR",
		msg: ["Expected `(` after OPERATOR"],
	},
	4801: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN",
		msg: ["Expected ) after OPERATOR("],
	},
	4802: {
		id: "EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN",
		msg: ["Expected operator after OPERATOR("],
	},
	4803: {
		id: "EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME",
		msg: ["Expected ( after ANY/ALL/SOME"],
	},
	4804: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION",
		msg: ["Expected ) after ANY/ALL/SOME expression"],
	},

	// EXISTS/Subquery
	4900: {
		id: "EXPECTED_OPEN_PAREN_AFTER_EXISTS",
		msg: ["Expected `(` after EXISTS"],
	},
	4901: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY",
		msg: ["Expected `)` after subquery"],
	},

	// Misc Expression
	5000: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST",
		msg: ["Expected `,` or `)` in argument list"],
	},
	5001: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT",
		msg: ["Expected `)` after function name in DEFAULT"],
	},
	5002: {
		id: "EXPECTED_NULL_AFTER_IS",
		msg: ["Expected NULL after IS"],
	},
	5003: {
		id: "EXPECTED_NULL_AFTER_IS_NOT",
		msg: ["Expected NULL after IS NOT"],
	},
	5004: {
		id: "EXPECTED_NULL_AFTER_DROP_NOT",
		msg: ["Expected NULL after DROP NOT"],
	},
	5005: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_STAR",
		msg: ["Expected `)` after `*`"],
	},
	5006: {
		id: "EXPECTED_CLOSE_PAREN",
		msg: ["Expected `)`"],
	},
	5007: {
		id: "UNSUPPORTED_PARENTHESIZED_EXPRESSION",
		msg: ["Unsupported parenthesized expression"],
	},

	// Type/Data Specific Errors
	// VARCHAR/NUMERIC
	5100: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH",
		msg: ["Expected ) after VARCHAR length"],
	},
	5101: {
		id: "EXPECTED_NUMBER_FOR_VARCHAR_LENGTH",
		msg: ["Expected number for VARCHAR length"],
	},
	5102: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE",
		msg: ["Expected ) after NUMERIC scale"],
	},
	5103: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION",
		msg: ["Expected , or ) after NUMERIC precision"],
	},
	5104: {
		id: "EXPECTED_PRECISION_NUMBER",
		msg: ["Expected precision number"],
	},
	5105: {
		id: "EXPECTED_SCALE_NUMBER",
		msg: ["Expected scale number"],
	},

	// DEFAULT Values
	5200: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_BOOLEAN_COLUMN_FOR_BOOLEAN_LITERAL",
		msg: ["DEFAULT value type mismatch: expected boolean column for boolean literal"],
	},
	5201: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_NUMERIC_COLUMN_FOR_NUMERIC_LITERAL",
		msg: ["DEFAULT value type mismatch: expected numeric column for numeric literal"],
	},
	5202: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_TEXT_UUID_COLUMN_FOR_STRING_LITERAL",
		msg: ["DEFAULT value type mismatch: expected text/uuid column for string literal"],
	},
	5203: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_NOW_REQUIRES_TIMESTAMP_COLUMN",
		msg: ["DEFAULT value type mismatch: now() requires timestamp column"],
	},
	5204: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_UUID_FUNCTION_REQUIRES_UUID_COLUMN",
		msg: ["DEFAULT value type mismatch: UUID function requires uuid column"],
	},

	// FETCH/LIMIT
	5300: {
		id: "EXPECTED_FIRST_OR_NEXT_AFTER_FETCH",
		msg: ["Expected FIRST or NEXT after FETCH"],
	},
	5301: {
		id: "EXPECTED_ROW_OR_ROWS_IN_FETCH",
		msg: ["Expected ROW or ROWS in FETCH"],
	},
	5302: {
		id: "EXPECTED_ONLY_AFTER_FETCH_ROW",
		msg: ["Expected ONLY after FETCH … ROW"],
	},
	5303: {
		id: "EXPECTED_ONLY_AFTER_FETCH_ROWS",
		msg: ["Expected ONLY after FETCH … ROWS"],
	},

	// Misc
	5400: {
		id: "EXPECTED_TO_IN_RENAME_COLUMN",
		msg: ["Expected TO in RENAME COLUMN"],
	},
	5401: {
		id: "EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN",
		msg: ["Expected old column name in RENAME COLUMN"],
	},
	5402: {
		id: "EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN",
		msg: ["Expected new column name after TO in RENAME COLUMN"],
	},
	5403: {
		id: "UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE",
		msg: ["Unsupported ALTER COLUMN SET clause"],
	},
	5404: {
		id: "UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE",
		msg: ["Unsupported ALTER COLUMN DROP clause"],
	},
	5405: {
		id: "UNSUPPORTED_ALTER_TABLE_ACTION",
		msg: ["Unsupported ALTER TABLE action"],
	},
	5406: {
		id: "UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY",
		msg: ["Unexpected end in CREATE TYPE enum body"],
	},
	5407: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE",
		msg: ["Expected `,` or `)` after DEFAULT value"],
	},
	5408: {
		id: "EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET",
		msg: ["Expected `,`, WHERE, or end after ON CONFLICT SET"],
	},
} as const satisfies Record<
	number,
	{
		id: string
		msg: [string, ...string[]]
	}
>

type ErrorsConst = typeof errors

type Errors = {
	-readonly [K in keyof ErrorsConst as ErrorsConst[K]["id"]]: { code: K } & ErrorsConst[K] extends infer T
		? { -readonly [K in keyof T]: T[K] }
		: never
}

type JoinWithArgs<Msg extends readonly string[], Args extends (string|number)[]> = Msg extends readonly [
	infer First,
	...infer Rest,
]
	? First extends string
		? Rest extends readonly string[]
			? Args extends readonly [infer Arg, ...infer RestArgs]
				? Arg extends string
					? RestArgs extends (string|number)[]
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

const duplicateIds = Map.groupBy(Object.entries(errors), ([, e]) => e.id)
	.entries()
	.map(
		([id, entries]) =>
			entries.length > 1 && `Error codes ${entries.map(([code]) => code).join(", ")} have the same id "${id}"`,
	)
	.filter(Boolean)
	.toArray()
	.join("; ")

if (duplicateIds) {
	throw new Error(duplicateIds)
}
