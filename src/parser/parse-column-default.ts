import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { EnumAssignmentCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { EmptyExpressionParams, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST, SameComparisonClass } from "./resolve-expression.ts"
import type { ColumnFail, ColumnStateWith } from "./parse-column-constraint-clauses.ts"
import type { ColumnCtx, ColumnState, ParseColumnConstraints } from "./parse-column-constraints.ts"

/**
 * After `DEFAULT`: the expression is typed like an INSERT value (DML-16) and must fit the column (CORE-15, CORE-16).
 * An unknown function is not checked: function catalogs are the dialects' (PGT-18, SQLT-19).
 */
export type ParseColumnDefault<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<"," | ")" | ";"> | TokenEot
		? ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_DEFAULT_VALUE"], []>>
		: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
			? DefaultFits<DateTimeKeywordType<PeekToken<Tokens>["value"], C["db"]>, C> extends infer Err
				? Err extends DbtyperErrorShape
					? ColumnFail<SkipToken<Tokens>, C, Err>
					: ParseColumnConstraints<
							SkipToken<Tokens>,
							C,
							ColumnStateWith<S, { def: true; afterDefault: true }>
						>
				: never
			: ParseExpressionAST<
						Tokens,
						{ db: C["db"]; params: EmptyExpressionParams; outerScope: {}; noPostfixNot: true }
				  > extends [infer R extends ParserMonad, infer Ast, infer _Env]
				? Ast extends DbtyperErrorShape
					? ColumnFail<R, C, Ast>
					: Ast extends ScalarExprAst
						? DefaultFits<
								ResolveExpressionAST<Ast, C["db"], {}, EmptyExpressionParams>,
								C,
								Ast
							> extends infer Err
							? Err extends DbtyperErrorShape
								? ColumnFail<R, C, DefaultSyntaxError<Ast, Err>>
								: ParseColumnConstraints<R, C, ColumnStateWith<S, { def: true; afterDefault: true }>>
							: never
						: never
				: never

/** The type of `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` (the expression parser has no such keywords). */
type DateTimeKeywordType<K extends string, Db extends JsqlDatabaseShape> = {
	// SQLite (SQLT-19): the CURRENT_* values are text, and any column may default to them
	type: DialectFact<Db, "ddl"> extends true
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
type DefaultSyntaxError<Ast, Err extends DbtyperErrorShape> = Err extends { __sql_parser_error_code__: 2300 }
	? Ast extends { kind: "function_call" }
		? FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT"], []>
		: Err
	: Err

/** `null` when the resolved DEFAULT expression fits the column, else the error. */
type DefaultFits<V, C extends ColumnCtx, Ast = never> = V extends {
	__sql_parser_error_code__: Errors["UNKNOWN_FUNCTION"]["code"]
}
	? null
	: V extends DbtyperErrorShape
		? V
		: V extends SqlTypeShape
			? V["type"] extends "null"
				? null
				: WithEnumCheck<
							EnumAssignmentCheck<C["db"], C["type"], Ast>,
							SameComparisonClass<V, C["type"], Ast>
					  > extends infer Fit
					? Fit extends DbtyperErrorShape
						? Fit
						: Fit extends true
							? null
							: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [C["name"]]>
					: never
			: never
