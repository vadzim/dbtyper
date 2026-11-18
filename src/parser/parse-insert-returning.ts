import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseAndResolveReturningClause } from "./parse-select-returning.ts"
import type { FinishInsertSemicolon } from "./parse-insert.ts"
import type { BuildInsertResult } from "./parse-insert-values.ts"

export type ParseInsertMaybeReturning<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	_Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? SkipToken<Tokens> extends infer Rr extends ParserMonad
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends ParserMonad,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends DbtyperErrorShape
					? [Ra, DbA, Ret]
					: Ret extends JsqlSelectStatementResult
						? FinishInsertSemicolon<Ra, DbA, BuildInsertResult<Sch, Tab, Cols, UpsertCols, Ret>>
						: never
				: never
			: never
		: FinishInsertSemicolon<Tokens, Db, BuildInsertResult<Sch, Tab, Cols, UpsertCols, Returning>>
