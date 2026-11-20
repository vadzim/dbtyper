import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, SourceSpan, TokenEotWithDialectError } from "../lexer/parser-monad.ts"
import type { TokenParam } from "../lexer/sql-lexer.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { RawSelectItem, RawSelectParamItem } from "./parse-select.ts"

export type ParseRawSelectList<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
	Acc extends readonly RawSelectItem[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? [Tokens, Acc]
		: PeekToken<Tokens> extends TokenKey<"*">
			? ParseRawSelectListAfterItem<SkipToken<Tokens>, Db, Params, OuterScope, [...Acc, { kind: "star" }]>
			: ParseOneRawSelectItem<Tokens, Db, Params, OuterScope> extends [
						infer AfterItem extends ParserMonad,
						infer It,
				  ]
				? It extends DbtyperErrorShape
					? SkipFailedExpression<AfterItem, It>
					: It extends RawSelectItem
						? ParseRawSelectListAfterItem<AfterItem, Db, Params, OuterScope, [...Acc, It]>
						: never
				: never

type ParseRawSelectListAfterItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly RawSelectItem[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"from">
				? // `select id, from t`: an item is missing after the comma (#168)
					SkipFailedExpression<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["from"]>>
				: ParseRawSelectList<R1, Db, Params, OuterScope, Acc>
			: never
		: [Tokens, Acc]

type ParseOneRawSelectExprItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: OuterScope }> extends [
		infer RExpr extends ParserMonad,
		infer Out,
		infer _UpdatedEnv,
	]
		? Out extends DbtyperErrorShape
			? [RExpr, Out]
			: Out extends ScalarExprAst
				? (
						DialectFact<Db, "exprKeys"> extends "text"
							? SourceSpan<PeekToken<Tokens>, PeekToken<RExpr>>
							: ""
					) extends infer Text extends string
					? ParseOptionalAs<RExpr> extends [infer M2 extends ParserMonad, infer As]
						? As extends DbtyperErrorShape
							? [M2, As]
							: As extends string
								? [M2, { kind: "expr"; ast: Out; as: As }]
								: Text extends ""
									? [M2, { kind: "expr"; ast: Out }]
									: Out extends
												| { kind: "col" }
												| { kind: "qualified_table_star" }
												| { kind: "alias_table_star" }
										? [M2, { kind: "expr"; ast: Out }]
										: // SQLT-28: the result key is the expression text as written
											[M2, { kind: "expr"; ast: Out; key: Text }]
						: never
					: never
				: never
		: never

type ParseOneRawSelectItem<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenParam<string>
		? // parse a full expression (`:x + 1`); a bare `:x` stays a param item
			ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope> extends [infer M2 extends ParserMonad, infer It]
			? It extends { kind: "expr"; ast: { kind: "param"; name: infer P extends string }; as?: infer As }
				? [M2, RawSelectParamItem<P, [As] extends [string] ? As : undefined>]
				: [M2, It]
			: never
		: PeekToken<Tokens> extends TokenEotWithDialectError
			? // the text ended at a lexer error (1001-1004): stop here, ApplyStatements reports that error (#116 item 25)
				[Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["end of text"]>]
			: // anything else starts an expression: the expression parser says what may start one (and reports the rest)
				ParseOneRawSelectExprItem<Tokens, Db, Params, OuterScope>

/**
 * `[AS] alias` after a select item (SEL-35: the `AS` may be left out, as in both engines). Returns `[Tokens, name |
 * undefined | error]`: `AS` without a name is 1114 (#168). A bare word is an alias unless it is `WITH` (`WITH [NO] DATA`
 * after a materialized view's query, PGT-20).
 */
type ParseOptionalAs<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"as">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer N extends string>
				? [SkipToken<R1>, AliasKey<PeekToken<R1>, N>]
				: [R1, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>]
			: never
		: PeekToken<Tokens> extends TokenIdent<infer N extends string>
			? N extends "with"
				? [Tokens, undefined]
				: [SkipToken<Tokens>, AliasKey<PeekToken<Tokens>, N>]
			: [Tokens, undefined]

/** SQLT-28: a SQLite result key is the alias as written. */
type AliasKey<Tok, N extends string> = Tok extends { written: infer W extends string } ? W : N
