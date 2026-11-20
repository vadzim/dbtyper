import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { EnumAssignmentCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type { AffinityTakesAnyValue } from "../core/dialect-types.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { EmptyExpressionParams, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST, SameComparisonClass } from "./resolve-expression.ts"
import type { ColumnFail, ColumnStateWith } from "./parse-column-constraint-clauses.ts"
import type { ColumnCtx, ColumnState, ParseColumnConstraints } from "./parse-column-constraints.ts"

/**
 * After `DEFAULT`: the expression is typed like an INSERT value (DML-16) and must fit the column (CORE-15, CORE-16).
 * An unknown function is not checked: function catalogs are the dialects' (PGT-18, SQLT-19).
 * The value is checked by {@link ParseDefaultValue}, which knows nothing of the table being built: the rest of the
 * CREATE TABLE goes on from its small result, not from inside the expression parser's branches (a DEFAULT expression
 * made every later column dearer, quadratic in the column count, #175).
 */
export type ParseColumnDefault<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	ParseDefaultValue<Tokens, C["db"], C["type"], C["name"]> extends [infer R extends ParserMonad, infer Err]
		? Err extends DbtyperErrorShape
			? ColumnFail<R, C, Err>
			: ParseColumnConstraints<R, C, ColumnStateWith<S, { def: true; afterDefault: true }>>
		: never

/**
 * A DEFAULT value for a column of type `Type` (CREATE TABLE, ALTER COLUMN … SET DEFAULT): `[rest, null]` when it fits,
 * else `[rest, error]`; `Tokens` is at the token after `DEFAULT`.
 */
export type ParseDefaultValue<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Type extends SqlTypeShape,
	Name extends string,
> =
	PeekToken<Tokens> extends TokenKey<"," | ")" | ";"> | TokenEot
		? [Tokens, FormatError<Errors["EXPECTED_DEFAULT_VALUE"], []>]
		: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
			? [SkipToken<Tokens>, DefaultFits<DateTimeKeywordType<PeekToken<Tokens>["value"], Db>, Db, Type, Name>]
			: ParseExpressionAST<
						Tokens,
						{ db: Db; params: EmptyExpressionParams; outerScope: {}; noPostfixNot: true }
				  > extends [infer R extends ParserMonad, infer Ast, infer _Env]
				? Ast extends DbtyperErrorShape
					? [R, Ast]
					: [PeekToken<Tokens>, Ast] extends [TokenKey<"(">, unknown] | [unknown, DefaultLiteral]
						? DefaultValueFits<R, Ast, Db, Type, Name>
						: // SQLite: an expression other than a literal must be in parentheses (`DEFAULT (now())`)
							DbDialectOnlyError<Db, "pg-default-expression"> extends infer OnlyErr extends
									DbtyperErrorShape
							? [R, OnlyErr]
							: DefaultValueFits<R, Ast, Db, Type, Name>
				: never

/** A DEFAULT that every dialect takes without parentheses: a literal or a signed number. */
type DefaultLiteral =
	{ kind: "true" | "false" | "sql_null" | "string" | "number" | "blob" } | { kind: "neg"; inner: { kind: "number" } }

type DefaultValueFits<
	R extends ParserMonad,
	Ast,
	Db extends JsqlDatabaseShape,
	Type extends SqlTypeShape,
	Name extends string,
> = Ast extends ScalarExprAst
	? DefaultFits<ResolveExpressionAST<Ast, Db, {}, EmptyExpressionParams>, Db, Type, Name, Ast> extends infer Err
		? Err extends DbtyperErrorShape
			? [R, DefaultSyntaxError<Ast, Err>]
			: [R, null]
		: never
	: never

/** The type of `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` (the expression parser has no such keywords). */
type DateTimeKeywordType<K extends string, Db extends JsqlDatabaseShape> = {
	// SQLite (SQLT-19): the CURRENT_* values are text, and any column may default to them
	type: DialectFact<Db, "currentDatetimeType"> extends "any"
		? "any"
		: K extends "current_date"
			? "date"
			: K extends "current_time"
				? "time"
				: "timestamp"
	arg: null
	nullable: false
}

/**
 * A column name inside a function call of a DEFAULT (`now( invalid)`) keeps its old error (SCHEMA-15):
 * a DEFAULT has no columns in scope, so an unknown name in a call is a broken call.
 */
type DefaultSyntaxError<Ast, Err extends DbtyperErrorShape> = Err extends {
	__sql_parser_error_code__: Errors["UNKNOWN_COLUMN"]["code"]
}
	? Ast extends { kind: "function_call" }
		? FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT"], []>
		: Err
	: Err

/** `null` when the resolved DEFAULT expression fits the column, else the error. */
type DefaultFits<V, Db, Type extends SqlTypeShape, Name extends string, Ast = never> = V extends {
	__sql_parser_error_code__: Errors["UNKNOWN_FUNCTION"]["code"]
}
	? null
	: V extends DbtyperErrorShape
		? V
		: V extends SqlTypeShape
			? V["type"] extends "null"
				? null
				: WithEnumCheck<EnumAssignmentCheck<Db, Type, Ast>, SameComparisonClass<V, Type, Ast>> extends infer Fit
					? Fit extends DbtyperErrorShape
						? Fit
						: Fit extends true
							? null
							: AffinityTakesAnyValue<Db, Type["type"]> extends true
								? null
								: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [Name]>
					: never
			: never
