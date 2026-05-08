export type SqlParserError<Message extends string> = {
	__sql_parser_error__: Message
}

/**
 * Error Code Registry
 * 
 * This registry maps error codes to error messages with unique identifiers.
 * 
 * Error Code Ranges:
 * - 100-199: Lexer/Tokenization Errors
 * - 200-299: Parser Syntax Errors (Expected X)
 * - 300-399: Validation Errors (Invalid X)
 * - 400-499: Resolution Errors (Unknown X)
 * - 500-599: Type System Errors
 * - 600-699: Semantic/Constraint Errors
 * - 700-799: DDL-Specific Errors
 * - 800-899: DML/Expression-Specific Errors
 * - 900-999: Type/Data Specific Errors
 * 
 * Guidelines for adding new error codes:
 * 1. Choose appropriate code range based on error category
 * 2. Create unique SCREAMING_SNAKE_CASE identifier
 * 3. Use array format for messages with interpolation: ["part1", "part2"]
 * 4. Use single-element array for static messages: ["message"]
 * 5. Ensure no duplicate IDs (compile-time check will catch this)
 * 6. Ensure no duplicate messages (compile-time check will catch this)
 */
export const errors = {
	// 100-199: Lexer/Tokenization Errors
	101: {
		id: "UNCLOSED_QUOTED_IDENTIFIER",
		msg: ["Unclosed quoted identifier literal"],
	},
	102: {
		id: "UNCLOSED_STRING_LITERAL",
		msg: ["Unclosed string literal"],
	},
	103: {
		id: "UNCLOSED_TAGGED_STRING",
		msg: ["Unclosed tagged string"],
	},
	104: {
		id: "WRONG_STRING_TAG",
		msg: ["Wrong string tag"],
	},
	105: {
		id: "UNBALANCED_PARENTHESES",
		msg: ["Unbalanced parentheses"],
	},
	106: {
		id: "TOKEN_NOT_FOUND",
		msg: ["Token not found"],
	},
	107: {
		id: "UNEXPECTED_TOKEN",
		msg: ["Unexpected token"],
	},
	108: {
		id: "CLOSING_BRACKET_NOT_FOUND",
		msg: ["Closing bracket not found: ", ""],
	},
	109: {
		id: "UNMATCHED_CLOSING_BRACKET",
		msg: ["Unmatched closing bracket: ", ""],
	},

	// 200-299: Parser Syntax Errors - Expected Keywords/Tokens
	// 200-219: SELECT Statement
	200: {
		id: "EXPECTED_SELECT_AFTER_WITH",
		msg: ["Expected SELECT after WITH clause"],
	},
	201: {
		id: "EXPECTED_SELECT_IN_SUBQUERY",
		msg: ["Expected SELECT in subquery"],
	},
	202: {
		id: "EXPECTED_SELECT_IN_DERIVED_TABLE",
		msg: ["Expected SELECT in derived table"],
	},
	203: {
		id: "EXPECTED_SELECT_IN_EXISTS_SUBQUERY",
		msg: ["Expected SELECT in EXISTS subquery"],
	},
	204: {
		id: "EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW",
		msg: ["Expected SELECT or WITH after AS in CREATE VIEW"],
	},
	205: {
		id: "EXPECTED_SEMICOLON_AFTER_SELECT",
		msg: ["Expected semicolon after SELECT"],
	},
	206: {
		id: "EXPECTED_FROM_AFTER_SELECT_LIST",
		msg: ["Expected FROM after SELECT list"],
	},
	207: {
		id: "EXPECTED_BY_AFTER_GROUP",
		msg: ["Expected BY after GROUP"],
	},
	208: {
		id: "EXPECTED_BY_AFTER_ORDER",
		msg: ["Expected BY after ORDER"],
	},
	209: {
		id: "EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE",
		msg: ["Expected BY after ORDER in OVER clause"],
	},
	210: {
		id: "EXPECTED_BY_AFTER_PARTITION",
		msg: ["Expected BY after PARTITION"],
	},
	211: {
		id: "EXPECTED_CTE_NAME_IN_WITH",
		msg: ["Expected CTE name in WITH"],
	},
	212: {
		id: "EXPECTED_ALIAS_AFTER_CTE",
		msg: ["Expected alias after CTE"],
	},
	213: {
		id: "EXPECTED_ALIAS_AFTER_DERIVED_TABLE",
		msg: ["Expected alias after derived table"],
	},
	214: {
		id: "EXPECTED_ALIAS_NAME_AFTER_AS",
		msg: ["Expected alias name after AS"],
	},
	215: {
		id: "EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE",
		msg: ["Expected alias or join clause after table"],
	},
	216: {
		id: "EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH",
		msg: ["Expected open paren after AS in WITH"],
	},
	217: {
		id: "EXPECTED_END_AFTER_CASE",
		msg: ["Expected END after CASE"],
	},
	218: {
		id: "EXPECTED_WHEN_AFTER_CASE_EXPRESSION",
		msg: ["Expected WHEN after CASE expression"],
	},
	219: {
		id: "EXPECTED_WHEN_ELSE_OR_END_IN_CASE",
		msg: ["Expected WHEN ELSE or END in CASE"],
	},

	// 220-239: INSERT Statement
	220: {
		id: "EXPECTED_INTO_AFTER_INSERT",
		msg: ["Expected INTO after INSERT"],
	},
	221: {
		id: "EXPECTED_SEMICOLON_AFTER_INSERT",
		msg: ["Expected `;` after INSERT"],
	},
	222: {
		id: "EXPECTED_OPEN_PAREN_AFTER_VALUES_IN_INSERT",
		msg: ["Expected `(` after VALUES in INSERT"],
	},
	223: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_INSERT_VALUES",
		msg: ["Expected `)` after INSERT values"],
	},
	224: {
		id: "EXPECTED_OPEN_PAREN_AFTER_COMMA_BETWEEN_INSERT_VALUES_ROWS",
		msg: ["Expected `(` after `,` between INSERT VALUES rows"],
	},
	225: {
		id: "EXPECTED_OPEN_PAREN_COLUMN_LIST_AFTER_TABLE_IN_INSERT",
		msg: ["Expected `(` (column list) after table in INSERT"],
	},
	226: {
		id: "EXPECTED_COLUMN_NAME_IN_INSERT_COLUMN_LIST",
		msg: ["Expected column name in INSERT column list"],
	},
	227: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST",
		msg: ["Expected `,` or `)` in INSERT column list"],
	},
	228: {
		id: "EXPECTED_COMMA_BETWEEN_INSERT_VALUES",
		msg: ["Expected `,` between INSERT values"],
	},
	229: {
		id: "EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT",
		msg: ["Expected VALUES or SELECT after column list in INSERT"],
	},
	230: {
		id: "EXPECTED_CONFLICT_AFTER_ON_IN_INSERT",
		msg: ["Expected CONFLICT after ON in INSERT"],
	},
	231: {
		id: "EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT",
		msg: ["Expected `(` after ON CONFLICT in INSERT"],
	},
	232: {
		id: "EXPECTED_COLUMN_NAME_IN_ON_CONFLICT",
		msg: ["Expected column name in ON CONFLICT"],
	},
	233: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST",
		msg: ["Expected `,` or `)` in ON CONFLICT column list"],
	},
	234: {
		id: "EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT",
		msg: ["Expected DO after ON CONFLICT column list in INSERT"],
	},
	235: {
		id: "EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT",
		msg: ["Expected DO after ON CONFLICT columns in INSERT"],
	},
	236: {
		id: "EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT",
		msg: ["Expected UPDATE after DO in INSERT ON CONFLICT"],
	},
	237: {
		id: "EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT",
		msg: ["Expected SET after UPDATE in INSERT ON CONFLICT"],
	},
	238: {
		id: "EXPECTED_COLUMN_NAME_IN_ON_CONFLICT_UPDATE",
		msg: ["Expected column name in ON CONFLICT UPDATE"],
	},
	239: {
		id: "EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE",
		msg: ["Expected `=` after column in ON CONFLICT UPDATE"],
	},

	// 240-249: UPDATE Statement
	240: {
		id: "EXPECTED_SET_IN_UPDATE",
		msg: ["Expected SET in UPDATE"],
	},
	241: {
		id: "EXPECTED_SET_AFTER_TABLE_IN_UPDATE",
		msg: ["Expected SET after table in UPDATE"],
	},
	242: {
		id: "EXPECTED_SEMICOLON_AFTER_UPDATE",
		msg: ["Expected `;` after UPDATE"],
	},
	243: {
		id: "EXPECTED_COLUMN_NAME_IN_UPDATE_SET",
		msg: ["Expected column name in UPDATE SET"],
	},
	244: {
		id: "EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET",
		msg: ["Expected `=` after column in UPDATE SET"],
	},
	245: {
		id: "EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT",
		msg: ["Expected `,`, FROM, WHERE, or end after UPDATE assignment"],
	},
	246: {
		id: "EXPECTED_TABLE_NAME_IN_UPDATE",
		msg: ["Expected table name in UPDATE"],
	},
	247: {
		id: "EXPECTED_TABLE_NAME_IN_UPDATE_FROM",
		msg: ["Expected table name in UPDATE FROM"],
	},
	248: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_UPDATE",
		msg: ["Expected table name after `.` in UPDATE"],
	},

	// 250-259: DELETE Statement
	250: {
		id: "EXPECTED_FROM_AFTER_DELETE",
		msg: ["Expected FROM after DELETE"],
	},
	251: {
		id: "EXPECTED_SEMICOLON_AFTER_DELETE",
		msg: ["Expected `;` after DELETE"],
	},
	252: {
		id: "EXPECTED_TABLE_NAME_IN_DELETE_FROM",
		msg: ["Expected table name in DELETE FROM"],
	},
	253: {
		id: "EXPECTED_TABLE_NAME_IN_DELETE_USING",
		msg: ["Expected table name in DELETE USING"],
	},
	254: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_DELETE_FROM",
		msg: ["Expected table name after `.` in DELETE FROM"],
	},
	255: {
		id: "EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM",
		msg: ["Expected alias or end of table in DELETE FROM"],
	},

	// 260-269: CREATE TABLE
	260: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_TABLE",
		msg: ["Expected `;` after CREATE TABLE"],
	},
	261: {
		id: "EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE",
		msg: ["Expected `(` before column list in CREATE TABLE"],
	},
	262: {
		id: "EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE",
		msg: ["Expected `)` before end of CREATE TABLE"],
	},
	263: {
		id: "EXPECTED_COLUMN_NAME_IN_CREATE_TABLE",
		msg: ["Expected column name in CREATE TABLE"],
	},
	264: {
		id: "EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE",
		msg: ["Expected column type in CREATE TABLE"],
	},
	265: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION",
		msg: ["Expected `,` or `)` after column definition"],
	},
	266: {
		id: "EXPECTED_TABLE_NAME_IN_CREATE_TABLE",
		msg: ["Expected table name in CREATE TABLE"],
	},
	267: {
		id: "EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE",
		msg: ["Expected `not` after `IF` in CREATE TABLE"],
	},
	268: {
		id: "EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE",
		msg: ["Expected `exists` after `IF NOT` in CREATE TABLE"],
	},
	269: {
		id: "EXPECTED_DEFAULT_VALUE",
		msg: ["Expected DEFAULT value"],
	},

	// 270-279: ALTER TABLE
	270: {
		id: "EXPECTED_SEMICOLON_AFTER_ALTER_TABLE",
		msg: ["Expected `;` after ALTER TABLE"],
	},
	271: {
		id: "EXPECTED_TABLE_AFTER_ALTER",
		msg: ["Expected TABLE after ALTER"],
	},
	272: {
		id: "EXPECTED_TABLE_NAME_IN_ALTER_TABLE",
		msg: ["Expected table name in ALTER TABLE"],
	},
	273: {
		id: "EXPECTED_TABLE_NAME_AFTER_DOT_IN_ALTER_TABLE",
		msg: ["Expected table name after `.` in ALTER TABLE"],
	},
	274: {
		id: "EXPECTED_COLUMN_NAME_AFTER_ADD_IN_ALTER_TABLE",
		msg: ["Expected column name after ADD in ALTER TABLE"],
	},
	275: {
		id: "EXPECTED_COLUMN_NAME_AFTER_ALTER_COLUMN",
		msg: ["Expected column name after ALTER COLUMN"],
	},
	276: {
		id: "EXPECTED_COLUMN_NAME_AFTER_DROP_COLUMN",
		msg: ["Expected column name after DROP COLUMN"],
	},
	277: {
		id: "EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE",
		msg: ["Expected column type in ALTER TABLE"],
	},
	278: {
		id: "EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN",
		msg: ["Expected TYPE, SET, or DROP after ALTER COLUMN"],
	},
	279: {
		id: "EXPECTED_NULL_AFTER_SET_NOT",
		msg: ["Expected NULL after SET NOT"],
	},

	// 280-284: DROP TABLE
	280: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_TABLE",
		msg: ["Expected `;` after DROP TABLE"],
	},
	281: {
		id: "EXPECTED_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected table name in DROP TABLE"],
	},
	282: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_DROP_TABLE",
		msg: ["Expected `exists` after `IF` in DROP TABLE"],
	},
	283: {
		id: "EXPECTED_DOT_OR_END_OF_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected `.` or end of table name in DROP TABLE"],
	},
	284: {
		id: "EXPECTED_SEMICOLON_AFTER_QUALIFIED_TABLE_NAME_IN_DROP_TABLE",
		msg: ["Expected `;` after qualified table name in DROP TABLE"],
	},

	// 285-299: CREATE/ALTER/DROP TYPE
	285: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_TYPE",
		msg: ["Expected `;` after CREATE TYPE"],
	},
	286: {
		id: "EXPECTED_SEMICOLON_AFTER_ALTER_TYPE",
		msg: ["Expected `;` after ALTER TYPE"],
	},
	287: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_TYPE",
		msg: ["Expected `;` after DROP TYPE"],
	},
	288: {
		id: "EXPECTED_AS_AFTER_TYPE_NAME_IN_CREATE_TYPE",
		msg: ["Expected `as` after type name in CREATE TYPE"],
	},
	289: {
		id: "EXPECTED_ENUM_AFTER_AS_IN_CREATE_TYPE",
		msg: ["Expected `enum` after `AS` in CREATE TYPE"],
	},
	290: {
		id: "EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE",
		msg: ["Expected `(` before enum values in CREATE TYPE"],
	},
	291: {
		id: "EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_CREATE_TYPE",
		msg: ["Expected string literal for enum value in CREATE TYPE"],
	},
	292: {
		id: "EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE",
		msg: ["Expected string literal for enum value in ALTER TYPE"],
	},
	293: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_ENUM_VALUE_IN_CREATE_TYPE",
		msg: ["Expected `,` or `)` after enum value in CREATE TYPE"],
	},
	294: {
		id: "EXPECTED_TYPE_NAME_IN_ALTER_TYPE",
		msg: ["Expected type name in ALTER TYPE"],
	},
	295: {
		id: "EXPECTED_TYPE_NAME_IN_DROP_TYPE",
		msg: ["Expected type name in DROP TYPE"],
	},
	296: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE",
		msg: ["Expected type name after `.` in ALTER TYPE"],
	},
	297: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOT_IN_DROP_TYPE",
		msg: ["Expected type name after `.` in DROP TYPE"],
	},
	298: {
		id: "EXPECTED_ADD_IN_ALTER_TYPE",
		msg: ["Expected `add` in ALTER TYPE"],
	},
	299: {
		id: "EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE",
		msg: ["Expected `value` after `ADD` in ALTER TYPE"],
	},

	// 300-399: Validation Errors - Invalid X
	// 300-329: Expression Validation
	300: {
		id: "INVALID_SCALAR_EXPRESSION",
		msg: ["Invalid scalar expression"],
	},
	301: {
		id: "INVALID_COMPARISON_OPERAND",
		msg: ["Invalid comparison operand"],
	},
	302: {
		id: "INVALID_COMPARISON_OPERATOR",
		msg: ["Invalid comparison operator"],
	},
	303: {
		id: "INVALID_ARITHMETIC_OPERAND",
		msg: ["Invalid arithmetic operand"],
	},
	304: {
		id: "INVALID_BETWEEN_OPERAND",
		msg: ["Invalid BETWEEN operand"],
	},
	305: {
		id: "INVALID_BETWEEN_BOUND",
		msg: ["Invalid BETWEEN bound"],
	},
	306: {
		id: "INVALID_LIKE_OPERAND",
		msg: ["Invalid LIKE operand"],
	},
	307: {
		id: "INVALID_LIKE_PATTERN",
		msg: ["Invalid LIKE pattern"],
	},
	308: {
		id: "INVALID_IS_NULL_OPERAND",
		msg: ["Invalid IS NULL operand"],
	},
	309: {
		id: "INVALID_IS_NOT_NULL_OPERAND",
		msg: ["Invalid IS NOT NULL operand"],
	},
	310: {
		id: "INVALID_CAST_OPERAND",
		msg: ["Invalid cast operand"],
	},
	311: {
		id: "INVALID_CAST_TARGET",
		msg: ["Invalid cast target"],
	},
	312: {
		id: "INVALID_COLUMN_REFERENCE",
		msg: ["Invalid column reference"],
	},
	313: {
		id: "INVALID_CASE_EXPRESSION",
		msg: ["Invalid CASE expression"],
	},
	314: {
		id: "INVALID_CASE_DISCRIMINANT",
		msg: ["Invalid CASE discriminant"],
	},
	315: {
		id: "INVALID_CASE_BRANCH",
		msg: ["Invalid CASE branch"],
	},
	316: {
		id: "INVALID_CASE_WHEN_VALUE",
		msg: ["Invalid CASE WHEN value"],
	},
	317: {
		id: "INVALID_CASE_ELSE",
		msg: ["Invalid CASE ELSE"],
	},
	318: {
		id: "INVALID_GROUP_BY_EXPRESSION",
		msg: ["Invalid GROUP BY expression"],
	},
	319: {
		id: "INVALID_ORDER_BY_EXPRESSION",
		msg: ["Invalid ORDER BY expression"],
	},
	320: {
		id: "INVALID_IN_LEFT_OPERAND",
		msg: ["Invalid IN left operand"],
	},
	321: {
		id: "INVALID_IN_LIST_ELEMENT",
		msg: ["Invalid IN list element"],
	},
	322: {
		id: "INVALID_IN_SUBQUERY_COLUMN",
		msg: ["Invalid IN subquery column"],
	},
	323: {
		id: "INVALID_ANY_ALL_SOME_OPERAND",
		msg: ["Invalid ANY/ALL/SOME operand"],
	},
	324: {
		id: "INVALID_ANY_ALL_SOME_LEFT_OPERAND",
		msg: ["Invalid ANY/ALL/SOME left operand"],
	},
	325: {
		id: "INVALID_ANY_ALL_SOME_COMPARISON",
		msg: ["Invalid ANY/ALL/SOME comparison"],
	},
	326: {
		id: "INVALID_ANY_ALL_SOME_SUBQUERY_COLUMN",
		msg: ["Invalid ANY/ALL/SOME subquery column"],
	},
	327: {
		id: "INVALID_ARRAY_BASE_OPERAND",
		msg: ["Invalid array base operand"],
	},
	328: {
		id: "INVALID_ARRAY_SUBSCRIPT_OPERAND",
		msg: ["Invalid array subscript operand"],
	},
	329: {
		id: "INVALID_ARRAY_ELEMENT",
		msg: ["Invalid ARRAY element"],
	},

	// 330-349: Statement Validation
	330: {
		id: "INVALID_VALUE_EXPRESSION_IN_INSERT",
		msg: ["Invalid value expression in INSERT"],
	},
	331: {
		id: "INVALID_VALUE_EXPRESSION_IN_UPDATE",
		msg: ["Invalid value expression in UPDATE"],
	},
	332: {
		id: "INVALID_VALUE_EXPRESSION_IN_ON_CONFLICT_UPDATE",
		msg: ["Invalid value expression in ON CONFLICT UPDATE"],
	},
	333: {
		id: "INVALID_TABLE_IN_UPDATE_FROM",
		msg: ["Invalid table in UPDATE FROM"],
	},
	334: {
		id: "INVALID_TABLE_IN_DELETE_USING",
		msg: ["Invalid table in DELETE USING"],
	},
	335: {
		id: "INVALID_SUBQUERY_RESULT",
		msg: ["Invalid subquery result"],
	},
	336: {
		id: "INVALID_PARAMETER_TYPE_IN_SELECT",
		msg: ["Invalid parameter type in SELECT"],
	},
	337: {
		id: "INVALID_ALTER_TABLE_NAME",
		msg: ["Invalid ALTER TABLE name"],
	},
	338: {
		id: "INVALID_CREATE_TABLE_NAME_PARSE",
		msg: ["Invalid CREATE TABLE name parse"],
	},
	339: {
		id: "INVALID_DROP_TABLE_PARSE",
		msg: ["Invalid DROP TABLE parse"],
	},
	340: {
		id: "INVALID_CREATE_TYPE_NAME_PARSE",
		msg: ["Invalid CREATE TYPE name parse"],
	},
	341: {
		id: "INVALID_ALTER_TYPE_PARSE",
		msg: ["Invalid ALTER TYPE parse"],
	},
	342: {
		id: "INVALID_DROP_TYPE_PARSE",
		msg: ["Invalid DROP TYPE parse"],
	},
	343: {
		id: "INVALID_CUSTOM_OPERATOR_OPERAND",
		msg: ["Invalid custom operator operand"],
	},
	344: {
		id: "INVALID_TILDE_OPERAND",
		msg: ["Invalid ~ operand"],
	},
	345: {
		id: "INVALID_TILDE_PATTERN",
		msg: ["Invalid ~ pattern"],
	},
	346: {
		id: "INVALID_NUMBER",
		msg: ["Invalid number"],
	},
	347: {
		id: "INVALID_NUMBER_FOR_VARCHAR_LENGTH",
		msg: ["Invalid number for VARCHAR length"],
	},
	348: {
		id: "INVALID_PRECISION_NUMBER",
		msg: ["Invalid precision number"],
	},
	349: {
		id: "INVALID_SCALE_NUMBER",
		msg: ["Invalid scale number"],
	},

	// 400-499: Resolution Errors - Unknown X
	// 400-419: Table/Schema Resolution
	400: {
		id: "UNKNOWN_TABLE_FROM",
		msg: ["Unknown table in FROM"],
	},
	401: {
		id: "UNKNOWN_TABLE_UPDATE",
		msg: ["Unknown table in UPDATE"],
	},
	402: {
		id: "UNKNOWN_TABLE_IN_UPDATE_FROM",
		msg: ["Unknown table in UPDATE FROM"],
	},
	403: {
		id: "UNKNOWN_TABLE_INSERT_INTO",
		msg: ["Unknown table in INSERT INTO"],
	},
	404: {
		id: "UNKNOWN_TABLE_DELETE_FROM",
		msg: ["Unknown table in DELETE FROM"],
	},
	405: {
		id: "UNKNOWN_TABLE_IN_DELETE_USING",
		msg: ["Unknown table in DELETE USING"],
	},
	406: {
		id: "UNKNOWN_TABLE_IN_SELECT_STAR",
		msg: ["Unknown table in SELECT ... *"],
	},
	407: {
		id: "UNKNOWN_SCHEMA_OR_TABLE",
		msg: ["Unknown schema or table"],
	},
	408: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_FROM",
		msg: ["Unknown schema or table in FROM"],
	},
	409: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE",
		msg: ["Unknown schema or table in UPDATE"],
	},
	410: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE_FROM",
		msg: ["Unknown schema or table in UPDATE FROM"],
	},
	411: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO",
		msg: ["Unknown schema or table in INSERT INTO"],
	},
	412: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM",
		msg: ["Unknown schema or table in DELETE FROM"],
	},
	413: {
		id: "UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_USING",
		msg: ["Unknown schema or table in DELETE USING"],
	},
	414: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_TABLE",
		msg: ["Unknown schema for CREATE TABLE"],
	},
	415: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_TYPE",
		msg: ["Unknown schema for CREATE TYPE"],
	},
	416: {
		id: "UNKNOWN_SCHEMA_FOR_CREATE_VIEW",
		msg: ["Unknown schema for CREATE VIEW"],
	},

	// 420-429: Column Resolution
	420: {
		id: "UNKNOWN_COLUMN",
		msg: ["Unknown column"],
	},
	421: {
		id: "UNKNOWN_COLUMN_UPDATE_SET",
		msg: ["Unknown column in UPDATE SET"],
	},
	422: {
		id: "UNKNOWN_COLUMN_INSERT",
		msg: ["Unknown column in INSERT"],
	},
	423: {
		id: "UNKNOWN_COLUMN_IN_INSERT_COLUMN_LIST",
		msg: ["Unknown column in INSERT column list"],
	},
	424: {
		id: "UNKNOWN_COLUMN_IN_ON_CONFLICT",
		msg: ["Unknown column in ON CONFLICT"],
	},
	425: {
		id: "UNKNOWN_COLUMN_IN_ON_CONFLICT_DO_UPDATE_SET",
		msg: ["Unknown column in ON CONFLICT DO UPDATE SET"],
	},
	426: {
		id: "UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN",
		msg: ["Unknown column (schema.table.column)"],
	},
	427: {
		id: "UNKNOWN_QUALIFIED_COLUMN",
		msg: ["Unknown qualified column"],
	},
	428: {
		id: "UNKNOWN_ALIAS_IN_SELECT_STAR",
		msg: ["Unknown alias in SELECT ... *"],
	},

	// 430-439: Other Resolution
	430: {
		id: "UNKNOWN_QUERY_PARAMETER",
		msg: ["Unknown query parameter"],
	},
	431: {
		id: "UNKNOWN_QUERY_PARAMETER_IN_SELECT",
		msg: ["Unknown query parameter in SELECT"],
	},
	432: {
		id: "UNKNOWN_WINDOW_FUNCTION",
		msg: ["Unknown window function"],
	},

	// 500-599: Type System Errors
	// 500-519: Type Compatibility
	500: {
		id: "INCOMPATIBLE_TYPES_IN_COMPARISON",
		msg: ["Incompatible types in comparison"],
	},
	501: {
		id: "INCOMPATIBLE_TYPES_IN_ARITHMETIC",
		msg: ["Incompatible types in arithmetic"],
	},
	502: {
		id: "INCOMPATIBLE_TYPES_IN_CASE",
		msg: ["Incompatible types in CASE"],
	},
	503: {
		id: "INCOMPATIBLE_TYPES_IN_BETWEEN",
		msg: ["Incompatible types in BETWEEN"],
	},
	504: {
		id: "INCOMPATIBLE_TYPES_IN_IN_LIST",
		msg: ["Incompatible types in IN list"],
	},
	505: {
		id: "INCOMPATIBLE_TYPES_IN_IN_SUBQUERY",
		msg: ["Incompatible types in IN subquery"],
	},
	506: {
		id: "INCOMPATIBLE_TYPES_IN_JOIN_ON",
		msg: ["Incompatible types in JOIN ON"],
	},
	507: {
		id: "INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN",
		msg: ["Incompatible value type for column"],
	},
	508: {
		id: "INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN",
		msg: ["INSERT...SELECT type mismatch for column"],
	},

	// 520-529: Boolean Type Errors
	520: {
		id: "EXPRESSION_MUST_BE_BOOLEAN",
		msg: ["Expression must be boolean, but has a type", "."],
	},
	521: {
		id: "CASE_WHEN_MUST_BE_BOOLEAN",
		msg: ["CASE WHEN must be boolean"],
	},
	522: {
		id: "NOT_REQUIRES_BOOLEAN_OPERAND",
		msg: ["NOT requires a boolean operand"],
	},
	523: {
		id: "NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL",
		msg: ["NOT argument must be boolean, not NULL"],
	},
	524: {
		id: "AND_OPERANDS_MUST_BE_BOOLEAN",
		msg: ["AND operands must be boolean"],
	},
	525: {
		id: "OR_OPERANDS_MUST_BE_BOOLEAN",
		msg: ["OR operands must be boolean"],
	},
	526: {
		id: "NULL_NOT_VALID_BOOLEAN_OPERAND",
		msg: ["NULL is not a valid boolean operand (use IS NULL)"],
	},

	// 530-539: NULL Handling
	530: {
		id: "NULL_NOT_ALLOWED_NOT_NULL_COLUMN",
		msg: ["NULL not allowed for NOT NULL column"],
	},
	531: {
		id: "NULL_NOT_ALLOWED_ARITHMETIC",
		msg: ["NULL not allowed in arithmetic"],
	},
	532: {
		id: "NULL_NOT_ALLOWED_IN_BETWEEN",
		msg: ["NULL not allowed in BETWEEN"],
	},
	533: {
		id: "NULL_NOT_ALLOWED_IN_LIKE",
		msg: ["NULL not allowed in LIKE"],
	},
	534: {
		id: "USE_IS_NULL_INSTEAD_OF_EQUALS_NULL",
		msg: ["Use IS NULL instead of = null"],
	},

	// 540-549: Text/String Operations
	540: {
		id: "CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND",
		msg: ["|| requires at least one text operand"],
	},
	541: {
		id: "CANNOT_CONCATENATE_ARRAY_WITH_TEXT",
		msg: ["Cannot concatenate array with text"],
	},
	542: {
		id: "CANNOT_CONCATENATE_TEXT_WITH_ARRAY",
		msg: ["Cannot concatenate text with array"],
	},
	543: {
		id: "LIKE_LEFT_OPERAND_MUST_BE_TEXT",
		msg: ["LIKE left operand must be text"],
	},
	544: {
		id: "LIKE_PATTERN_MUST_BE_TEXT",
		msg: ["LIKE pattern must be text"],
	},
	545: {
		id: "FUNCTION_EXPECTS_TEXT_ARGUMENT",
		msg: ["Function expects text argument"],
	},

	// 550-559: Numeric Operations
	550: {
		id: "UNARY_MINUS_REQUIRES_A_NUMBER",
		msg: ["Unary minus requires a number"],
	},

	// 560-569: Array Operations
	560: {
		id: "CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY",
		msg: ["Cannot determine type of empty array"],
	},
	561: {
		id: "ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY",
		msg: ["ANY/ALL/SOME requires an array or subquery"],
	},

	// 570-579: Subquery Type Errors
	570: {
		id: "SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN",
		msg: ["Scalar subquery must project exactly one column"],
	},
	571: {
		id: "IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN",
		msg: ["IN subquery must project exactly one column"],
	},
	572: {
		id: "SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED",
		msg: ["Scalar subquery column inference failed"],
	},
	573: {
		id: "IN_SUBQUERY_COLUMN_INFERENCE_FAILED",
		msg: ["IN subquery column inference failed"],
	},

	// 600-699: Semantic/Constraint Errors
	// 600-619: Duplicate/Existence Checks
	600: {
		id: "SCHEMA_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Schema already exists; use IF NOT EXISTS"],
	},
	601: {
		id: "SCHEMA_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Schema does not exist; use IF EXISTS"],
	},
	602: {
		id: "TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Table already exists; use IF NOT EXISTS"],
	},
	603: {
		id: "TABLE_DOES_NOT_EXIST",
		msg: ["Table does not exist"],
	},
	604: {
		id: "TABLE_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Table does not exist; use IF EXISTS"],
	},
	605: {
		id: "TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS",
		msg: ["Type already exists; use IF NOT EXISTS"],
	},
	606: {
		id: "TYPE_DOES_NOT_EXIST_USE_IF_EXISTS",
		msg: ["Type does not exist; use IF EXISTS"],
	},
	607: {
		id: "TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS",
		msg: ["Type does not exist or is not an enum; use IF EXISTS"],
	},
	608: {
		id: "COLUMN_ALREADY_EXISTS",
		msg: ["Column already exists"],
	},
	609: {
		id: "COLUMN_DOES_NOT_EXIST",
		msg: ["Column does not exist"],
	},
	610: {
		id: "DUPLICATE_WITH_CLAUSE_NAME",
		msg: ["Duplicate WITH clause name"],
	},
	611: {
		id: "VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA",
		msg: ["View or table already exists in schema"],
	},

	// 620-639: Constraint Violations
	620: {
		id: "MISSING_NOT_NULL_COLUMN_IN_INSERT",
		msg: ["Missing NOT NULL column in INSERT"],
	},
	621: {
		id: "INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["INSERT column list must not be empty"],
	},
	622: {
		id: "ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["ON CONFLICT column list must not be empty"],
	},
	623: {
		id: "IN_LIST_MUST_NOT_BE_EMPTY",
		msg: ["IN list must not be empty"],
	},
	624: {
		id: "EMPTY_ENUM_VALUES_LIST_IN_CREATE_TYPE",
		msg: ["Empty enum values list in CREATE TYPE"],
	},
	625: {
		id: "ENUM_VALUE_ALREADY_EXISTS",
		msg: ["Enum value already exists"],
	},

	// 640-659: SELECT Constraints
	640: {
		id: "SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST",
		msg: ["SELECT * must be the only projection in the list"],
	},
	641: {
		id: "SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE",
		msg: ["SELECT * requires a single FROM table"],
	},
	642: {
		id: "SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS",
		msg: ["Scalar expression in SELECT requires AS alias"],
	},
	643: {
		id: "GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE",
		msg: ["Grouped SELECT requires column to appear in GROUP BY or inside an aggregate"],
	},
	644: {
		id: "AMBIGUOUS_UNQUALIFIED_COLUMN",
		msg: ["Ambiguous unqualified column"],
	},
	645: {
		id: "QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS",
		msg: ["Qualified table .* is only valid in SELECT lists"],
	},
	646: {
		id: "SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS",
		msg: ["SELECT result column index out of bounds"],
	},
	647: {
		id: "SELECT_RESULT_MISSING_COLUMN",
		msg: ["SELECT result missing column"],
	},

	// 660-679: Statement Constraints
	660: {
		id: "INSERT_SELECT_COLUMN_COUNT_MISMATCH",
		msg: ["INSERT...SELECT column count mismatch"],
	},
	661: {
		id: "STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT",
		msg: ["stream() requires a row-returning statement (SELECT or RETURNING clause)"],
	},
	662: {
		id: "DROP_TABLE_TARGETS_A_VIEW_USE_DROP_VIEW",
		msg: ["DROP TABLE targets a view; use DROP VIEW"],
	},
	663: {
		id: "ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES",
		msg: ["ALTER TABLE applies only to base tables"],
	},
	664: {
		id: "TABLE_KEY_MISMATCH_IN_ALTER_TABLE",
		msg: ["Table key mismatch in ALTER TABLE"],
	},
	665: {
		id: "COLUMN_RENAME_FAILED",
		msg: ["Column rename failed"],
	},

	// 680-699: Function Constraints
	680: {
		id: "THIS_FUNCTION_TAKES_NO_ARGUMENTS",
		msg: ["This function takes no arguments"],
	},
	681: {
		id: "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT",
		msg: ["Function requires at least one argument"],
	},
	682: {
		id: "ROW_NUMBER_TAKES_NO_ARGUMENTS",
		msg: ["ROW_NUMBER() takes no arguments"],
	},
	683: {
		id: "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS",
		msg: ["RANK/DENSE_RANK takes no arguments"],
	},
	684: {
		id: "NOW_TAKES_NO_ARGUMENTS",
		msg: ["now() takes no arguments"],
	},
	685: {
		id: "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT",
		msg: ["LAG/LEAD requires at least 1 argument"],
	},
	686: {
		id: "INVALID_LAG_LEAD_ARGUMENTS",
		msg: ["Invalid LAG/LEAD arguments"],
	},
	687: {
		id: "COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT",
		msg: ["coalesce() requires at least one argument"],
	},
	688: {
		id: "SUM_REQUIRES_AN_ARGUMENT",
		msg: ["sum() requires an argument"],
	},
	689: {
		id: "ARRAY_APPEND_REQUIRES_2_ARGUMENTS",
		msg: ["array_append requires 2 arguments"],
	},
	690: {
		id: "ARRAY_APPEND_EXPECTS_ARRAY_ELEMENT",
		msg: ["array_append expects (array, element)"],
	},
	691: {
		id: "ARRAY_PREPEND_REQUIRES_2_ARGUMENTS",
		msg: ["array_prepend requires 2 arguments"],
	},
	692: {
		id: "ARRAY_PREPEND_EXPECTS_ELEMENT_ARRAY",
		msg: ["array_prepend expects (element, array)"],
	},
	693: {
		id: "ARRAY_LENGTH_REQUIRES_2_ARGUMENTS",
		msg: ["array_length requires 2 arguments"],
	},
	694: {
		id: "ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER",
		msg: ["array_length expects (array, integer)"],
	},
	695: {
		id: "UNNEST_REQUIRES_1_ARGUMENT",
		msg: ["unnest requires 1 argument"],
	},
	696: {
		id: "UNNEST_EXPECTS_AN_ARRAY",
		msg: ["unnest expects an array"],
	},
	697: {
		id: "QUALIFIED_FUNCTION_NAMES_ARE_NOT_SUPPORTED",
		msg: ["Qualified function names are not supported"],
	},
	698: {
		id: "STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT",
		msg: ["`*` is only allowed as COUNT(*) argument"],
	},

	// 700-799: DDL-Specific Errors
	// 700-709: CREATE SCHEMA
	700: {
		id: "EXPECTED_SCHEMA_NAME_IN_CREATE_SCHEMA",
		msg: ["Expected schema name in CREATE SCHEMA"],
	},
	701: {
		id: "EXPECTED_SEMICOLON_AFTER_SCHEMA_NAME_IN_CREATE_SCHEMA",
		msg: ["Expected `;` after schema name in CREATE SCHEMA"],
	},
	702: {
		id: "EXPECTED_NOT_AFTER_IF_IN_CREATE_SCHEMA",
		msg: ["Expected `not` after `IF` in CREATE SCHEMA"],
	},
	703: {
		id: "EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_SCHEMA",
		msg: ["Expected `exists` after `IF NOT` in CREATE SCHEMA"],
	},

	// 710-719: DROP SCHEMA
	710: {
		id: "EXPECTED_SCHEMA_NAME_IN_DROP_SCHEMA",
		msg: ["Expected schema name in DROP SCHEMA"],
	},
	711: {
		id: "EXPECTED_SEMICOLON_AFTER_DROP_SCHEMA",
		msg: ["Expected `;` after DROP SCHEMA"],
	},
	712: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_DROP_SCHEMA",
		msg: ["Expected `exists` after `IF` in DROP SCHEMA"],
	},

	// 720-729: CREATE VIEW
	720: {
		id: "EXPECTED_VIEW_NAME_IN_CREATE_VIEW",
		msg: ["Expected view name in CREATE VIEW"],
	},
	721: {
		id: "EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW",
		msg: ["Expected view name after `.` in CREATE VIEW"],
	},
	722: {
		id: "EXPECTED_AS_IN_CREATE_VIEW",
		msg: ["Expected AS in CREATE VIEW"],
	},
	723: {
		id: "EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME",
		msg: ["Expected AS or `.` before view name"],
	},
	724: {
		id: "EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME",
		msg: ["Expected AS after qualified view name"],
	},
	725: {
		id: "EXPECTED_SEMICOLON_AFTER_CREATE_VIEW",
		msg: ["Expected semicolon after CREATE VIEW"],
	},

	// 730-739: ALTER TYPE
	730: {
		id: "EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE",
		msg: ["Expected `exists` after `IF` in ALTER TYPE"],
	},
	731: {
		id: "EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE",
		msg: ["Expected `.` or `ADD` in ALTER TYPE"],
	},
	732: {
		id: "EXPECTED_DOT_OR_SEMICOLON_AFTER_TYPE_NAME_IN_DROP_TYPE",
		msg: ["Expected `.` or `;` after type name in DROP TYPE"],
	},

	// 740-749: Misc DDL
	740: {
		id: "EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME",
		msg: ["Expected `(` after qualified table name"],
	},
	741: {
		id: "EXPECTED_NAME",
		msg: ["Expected name"],
	},
	742: {
		id: "EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME",
		msg: ["Expected name after `.` in qualified name"],
	},
	743: {
		id: "EXPECTED_DOT_OR_KEYWORD_AFTER_NAME",
		msg: ["Expected `.` or keyword after name"],
	},
	744: {
		id: "EXPECTED_TYPE_NAME",
		msg: ["Expected type name"],
	},
	745: {
		id: "EXPECTED_TYPE_NAME_AFTER_DOUBLE_COLON",
		msg: ["Expected type name after ::"],
	},
	746: {
		id: "EXPECTED_TYPE_NAME_AFTER_CAST_AS",
		msg: ["Expected type name after CAST ... AS"],
	},
	747: {
		id: "EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME",
		msg: ["Expected `.` or `(` after table name"],
	},

	// 800-899: DML/Expression-Specific Errors
	// 800-819: JOIN Operations
	800: {
		id: "EXPECTED_JOIN_AFTER_CROSS",
		msg: ["Expected JOIN after CROSS"],
	},
	801: {
		id: "EXPECTED_JOIN_AFTER_INNER",
		msg: ["Expected JOIN after INNER"],
	},
	802: {
		id: "EXPECTED_JOIN_AFTER_LEFT_OUTER",
		msg: ["Expected JOIN after LEFT OUTER"],
	},
	803: {
		id: "EXPECTED_JOIN_AFTER_RIGHT_OUTER",
		msg: ["Expected JOIN after RIGHT OUTER"],
	},
	804: {
		id: "EXPECTED_JOIN_AFTER_FULL_OUTER",
		msg: ["Expected JOIN after FULL OUTER"],
	},
	805: {
		id: "EXPECTED_JOIN_KEYWORD",
		msg: ["Expected JOIN keyword"],
	},
	806: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_LEFT",
		msg: ["Expected OUTER or JOIN after LEFT"],
	},
	807: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_RIGHT",
		msg: ["Expected OUTER or JOIN after RIGHT"],
	},
	808: {
		id: "EXPECTED_OUTER_OR_JOIN_AFTER_FULL",
		msg: ["Expected OUTER or JOIN after FULL"],
	},
	809: {
		id: "EXPECTED_ON_AFTER_JOIN_TABLE",
		msg: ["Expected ON after JOIN table"],
	},
	810: {
		id: "EXPECTED_ON_KEYWORD",
		msg: ["Expected ON keyword"],
	},

	// 820-829: CASE Expression
	820: {
		id: "CASE_REQUIRES_AT_LEAST_ONE_WHEN",
		msg: ["CASE requires at least one WHEN"],
	},
	821: {
		id: "EXPECTED_THEN_AFTER_CASE_WHEN",
		msg: ["Expected THEN after CASE WHEN"],
	},

	// 830-839: BETWEEN/IN Operations
	830: {
		id: "EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS",
		msg: ["Expected AND between BETWEEN bounds"],
	},
	831: {
		id: "EXPECTED_OPEN_PAREN_AFTER_IN",
		msg: ["Expected `(` after IN"],
	},
	832: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST",
		msg: ["Expected `,` or `)` in IN list"],
	},

	// 840-849: CAST Operations
	840: {
		id: "EXPECTED_OPEN_PAREN_AFTER_CAST",
		msg: ["Expected `(` after CAST"],
	},
	841: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_CAST_TYPE",
		msg: ["Expected `)` after CAST type"],
	},
	842: {
		id: "EXPECTED_AS_IN_CAST",
		msg: ["Expected AS in CAST"],
	},

	// 850-859: Window Functions
	850: {
		id: "EXPECTED_OPEN_PAREN_AFTER_OVER",
		msg: ["Expected ( after OVER"],
	},
	851: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE",
		msg: ["Expected ) after OVER clause"],
	},
	852: {
		id: "EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE",
		msg: ["Expected PARTITION BY or ORDER BY in OVER clause"],
	},
	853: {
		id: "EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY",
		msg: ["Expected ORDER BY or ) after PARTITION BY"],
	},

	// 860-869: Array Operations
	860: {
		id: "EXPECTED_CLOSE_BRACKET_AFTER_ARRAY_SUBSCRIPT",
		msg: ["Expected `]` after array subscript"],
	},
	861: {
		id: "EXPECTED_COMMA_OR_CLOSE_BRACKET_IN_ARRAY_CONSTRUCTOR",
		msg: ["Expected `,` or `]` in ARRAY constructor"],
	},
	862: {
		id: "EXPECTED_CLOSE_BRACKET_AFTER_OPEN_BRACKET_IN_ARRAY_TYPE",
		msg: ["Expected ] after [ in array type"],
	},

	// 870-879: Operators
	870: {
		id: "EXPECTED_OPEN_PAREN_AFTER_OPERATOR",
		msg: ["Expected `(` after OPERATOR"],
	},
	871: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_OPERATOR_OPEN_PAREN",
		msg: ["Expected ) after OPERATOR("],
	},
	872: {
		id: "EXPECTED_OPERATOR_AFTER_OPERATOR_OPEN_PAREN",
		msg: ["Expected operator after OPERATOR("],
	},
	873: {
		id: "EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME",
		msg: ["Expected ( after ANY/ALL/SOME"],
	},
	874: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION",
		msg: ["Expected ) after ANY/ALL/SOME expression"],
	},

	// 880-889: EXISTS/Subquery
	880: {
		id: "EXPECTED_OPEN_PAREN_AFTER_EXISTS",
		msg: ["Expected `(` after EXISTS"],
	},
	881: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY",
		msg: ["Expected `)` after subquery"],
	},

	// 890-899: Misc Expression
	890: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST",
		msg: ["Expected `,` or `)` in argument list"],
	},
	891: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT",
		msg: ["Expected `)` after function name in DEFAULT"],
	},
	892: {
		id: "EXPECTED_NULL_AFTER_IS",
		msg: ["Expected NULL after IS"],
	},
	893: {
		id: "EXPECTED_NULL_AFTER_IS_NOT",
		msg: ["Expected NULL after IS NOT"],
	},
	894: {
		id: "EXPECTED_NULL_AFTER_DROP_NOT",
		msg: ["Expected NULL after DROP NOT"],
	},
	895: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_STAR",
		msg: ["Expected `)` after `*`"],
	},
	896: {
		id: "EXPECTED_CLOSE_PAREN",
		msg: ["Expected `)`"],
	},
	897: {
		id: "UNSUPPORTED_PARENTHESIZED_EXPRESSION",
		msg: ["Unsupported parenthesized expression"],
	},

	// 900-999: Type/Data Specific Errors
	// 900-909: VARCHAR/NUMERIC
	900: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_VARCHAR_LENGTH",
		msg: ["Expected ) after VARCHAR length"],
	},
	901: {
		id: "EXPECTED_NUMBER_FOR_VARCHAR_LENGTH",
		msg: ["Expected number for VARCHAR length"],
	},
	902: {
		id: "EXPECTED_CLOSE_PAREN_AFTER_NUMERIC_SCALE",
		msg: ["Expected ) after NUMERIC scale"],
	},
	903: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_NUMERIC_PRECISION",
		msg: ["Expected , or ) after NUMERIC precision"],
	},
	904: {
		id: "EXPECTED_PRECISION_NUMBER",
		msg: ["Expected precision number"],
	},
	905: {
		id: "EXPECTED_SCALE_NUMBER",
		msg: ["Expected scale number"],
	},

	// 910-919: DEFAULT Values
	910: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_BOOLEAN_COLUMN_FOR_BOOLEAN_LITERAL",
		msg: ["DEFAULT value type mismatch: expected boolean column for boolean literal"],
	},
	911: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_NUMERIC_COLUMN_FOR_NUMERIC_LITERAL",
		msg: ["DEFAULT value type mismatch: expected numeric column for numeric literal"],
	},
	912: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_TEXT_UUID_COLUMN_FOR_STRING_LITERAL",
		msg: ["DEFAULT value type mismatch: expected text/uuid column for string literal"],
	},
	913: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_NOW_REQUIRES_TIMESTAMP_COLUMN",
		msg: ["DEFAULT value type mismatch: now() requires timestamp column"],
	},
	914: {
		id: "DEFAULT_VALUE_TYPE_MISMATCH_UUID_FUNCTION_REQUIRES_UUID_COLUMN",
		msg: ["DEFAULT value type mismatch: UUID function requires uuid column"],
	},

	// 920-929: FETCH/LIMIT
	920: {
		id: "EXPECTED_FIRST_OR_NEXT_AFTER_FETCH",
		msg: ["Expected FIRST or NEXT after FETCH"],
	},
	921: {
		id: "EXPECTED_ROW_OR_ROWS_IN_FETCH",
		msg: ["Expected ROW or ROWS in FETCH"],
	},
	922: {
		id: "EXPECTED_ONLY_AFTER_FETCH_ROW",
		msg: ["Expected ONLY after FETCH … ROW"],
	},
	923: {
		id: "EXPECTED_ONLY_AFTER_FETCH_ROWS",
		msg: ["Expected ONLY after FETCH … ROWS"],
	},

	// 930-939: Misc
	930: {
		id: "EXPECTED_TO_IN_RENAME_COLUMN",
		msg: ["Expected TO in RENAME COLUMN"],
	},
	931: {
		id: "EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN",
		msg: ["Expected old column name in RENAME COLUMN"],
	},
	932: {
		id: "EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN",
		msg: ["Expected new column name after TO in RENAME COLUMN"],
	},
	933: {
		id: "UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE",
		msg: ["Unsupported ALTER COLUMN SET clause"],
	},
	934: {
		id: "UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE",
		msg: ["Unsupported ALTER COLUMN DROP clause"],
	},
	935: {
		id: "UNSUPPORTED_ALTER_TABLE_ACTION",
		msg: ["Unsupported ALTER TABLE action"],
	},
	936: {
		id: "UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY",
		msg: ["Unexpected end in CREATE TYPE enum body"],
	},
	937: {
		id: "EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE",
		msg: ["Expected `,` or `)` after DEFAULT value"],
	},
	938: {
		id: "EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET",
		msg: ["Expected `,`, WHERE, or end after ON CONFLICT SET"],
	},
} as const satisfies Record<
	number,
	{
		id: string
		msg: string[]
	}
>

export type ErrorsConst = typeof errors

// Check for duplicate IDs - causes compile error if duplicates exist
type ErrorIds = { [K in keyof ErrorsConst as ErrorsConst[K]["id"]]: K }

// Utility types for duplicate detection
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never

type Push<T extends any[], V> = [...T, V]

type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N
	? []
	: Push<TuplifyUnion<Exclude<T, L>>, L>

type Join<T extends (string | number)[], Sep extends string = ", "> = T extends [
	infer F extends string | number,
	...infer R extends (string | number)[],
]
	? R extends []
		? `${F}`
		: `${F}${Sep}${Join<R, Sep>}`
	: never

// Check for duplicate IDs
type FoundDuplicateIds =
	Join<
		TuplifyUnion<
			{
				[K in keyof ErrorsConst]: ErrorIds[ErrorsConst[K]["id"]] extends K ? never : K
			}[keyof ErrorsConst]
		>
	> extends infer T
		? [T] extends [never]
			? false
			: `the codes ${T & string} contain duplicate ids ${ErrorsConst[T & keyof ErrorsConst]["id"] & string}`
		: never

type ShouldBeFalse<T extends false> = T
type _AssertNoDuplicateIds = ShouldBeFalse<FoundDuplicateIds>

// Check for duplicate messages
type ErrorMessages = { [K in keyof ErrorsConst as Join<ErrorsConst[K]["msg"], "">]: K }

type FoundDuplicateMessages =
	Join<
		TuplifyUnion<
			{
				[K in keyof ErrorsConst]: ErrorMessages[Join<ErrorsConst[K]["msg"], "">] extends K ? never : K
			}[keyof ErrorsConst]
		>
	> extends infer T
		? [T] extends [never]
			? false
			: `the codes ${T & string} contain duplicate messages`
		: never

type _AssertNoDuplicateMessages = ShouldBeFalse<FoundDuplicateMessages>
