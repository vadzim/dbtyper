import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type { SqlParserError, TokensList } from "../../core/sql-tokens.ts"
import type { ExpressionParamsShape, ExprOk, ParseOrEntry } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"

/** WHERE predicate: tuple `[rest, error | null]` (not monad-registered; use from statement parsers). */
export type ParseWhereExpression<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = {},
> =
	ParseOrEntry<Tokens, Db, Scope, { catalogAccess: "three_part"; params: Params }> extends [
		infer Rw extends TokensList,
		infer R,
	]
		? R extends SqlParserError<string>
			? [Rw, R]
			: R extends ExprOk<infer Ts, infer _Sql>
				? Ts extends boolean
					? [Rw, null]
					: [Rw, SqlParserError<"WHERE clause must be boolean">]
				: [Rw, SqlParserError<"WHERE clause must be boolean">]
		: never
