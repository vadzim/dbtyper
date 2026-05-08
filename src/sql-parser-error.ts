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

	// 400-499: Resolution Errors - Unknown X
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
	400: {
		id: "UNKNOWN_TABLE_FROM",
		msg: ["Unknown table in FROM"],
	},
	401: {
		id: "UNKNOWN_TABLE_UPDATE",
		msg: ["Unknown table in UPDATE"],
	},
	403: {
		id: "UNKNOWN_TABLE_INSERT_INTO",
		msg: ["Unknown table in INSERT INTO"],
	},
	404: {
		id: "UNKNOWN_TABLE_DELETE_FROM",
		msg: ["Unknown table in DELETE FROM"],
	},

	// 500-599: Type System Errors
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
	534: {
		id: "USE_IS_NULL_INSTEAD_OF_EQUALS_NULL",
		msg: ["Use IS NULL instead of = null"],
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
