import type {
	ReadExpectedToken,
	ReadOptionalToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { SkipStatement, SkippedStatement } from "./skip-statement.ts"
import type {
	TokensList,
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenString,
} from "../../core/sql-tokens.ts"

export type ColRef = { column: string; table?: string }

export type WhereAtom = { kind: "col"; ref: ColRef } | { kind: "lit"; value: string }

export type WhereEq = { kind: "eq"; left: WhereAtom; right: WhereAtom }

/** Flat `a = b AND c = d …` (no recursive `WhereExpr`; keeps type instantiation shallow). */
export type WhereConjunction = readonly WhereEq[]

export type OrderByItem = { ref: ColRef; direction?: "asc" | "desc" }

export type SelectColumn = { name: string; as?: string }

export type JoinClause = {
	kind: "inner" | "left"
	table: SqlQualifiedIdentifier
	on: WhereConjunction
}

export type FromClause = {
	primary: SqlQualifiedIdentifier
	joins: readonly JoinClause[]
}

export type SelectStatement = {
	kind: "select"
	distinct: boolean
	columns: "star" | readonly SelectColumn[]
	from: FromClause
	where?: WhereConjunction
	orderBy?: readonly OrderByItem[]
	limit?: string
	offset?: string
}

/** End of `SELECT` tail: statement terminator, end of input, or closing paren (subselect). */
export type SelectStatementEnd = TokenEot | TokenKey<";"> | TokenKey<")">

/**
 * `Tokens` must point **after** the `select` keyword (see `parse-sql-statement` dispatch).
 */
export type ParseSelect<Tokens extends TokensList, EndToken extends SelectStatementEnd = SelectStatementEnd> =
	ReadOptionalToken<Tokens, "distinct"> extends [infer R0 extends TokensList, infer HasDistinct]
		? ParseSelectList<R0> extends [infer R1 extends TokensList, infer ListResult]
			? ListResult extends SqlParserError<string>
				? [R1, ListResult]
				: ListResult extends "star" | readonly SelectColumn[]
					? AfterSelectList<R1, ListResult, HasDistinct extends true ? true : false, EndToken>
					: never
			: never
		: never

type AfterSelectList<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	EndToken extends SelectStatementEnd,
> = ReadExpectedToken<Tokens, "from", "Expected FROM after SELECT list"> extends [
	infer R2 extends TokensList,
	infer FromOk,
]
	? FromOk extends true
		? ReadQualifiedIdentifierFromBuffer<R2> extends [infer R3 extends TokensList, infer TableResult]
			? TableResult extends SqlParserError<string>
				? [R3, TableResult]
				: TableResult extends SqlQualifiedIdentifier
					? ParseJoinsTail<R3, []> extends [infer R4 extends TokensList, infer JoinsResult]
						? JoinsResult extends SqlParserError<string>
							? [R4, JoinsResult]
							: JoinsResult extends readonly JoinClause[]
								? AfterFromClause<R4, ListResult, Distinct, { primary: TableResult; joins: JoinsResult }, EndToken>
								: never
						: never
					: never
			: never
		: [R2, Extract<FromOk, SqlParserError<string>>]
	: never

type AfterFromClause<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	EndToken extends SelectStatementEnd,
> = ReadOptionalToken<Tokens, "where"> extends [infer Rw extends TokensList, infer HasWhere extends boolean]
	? HasWhere extends true
		? ParseWhereConjunction<Rw> extends [infer Rw2 extends TokensList, infer Wexpr]
			? Wexpr extends SqlParserError<string>
				? [Rw2, Wexpr]
				: Wexpr extends WhereConjunction
					? AfterOptionalWhere<Rw2, ListResult, Distinct, From, Wexpr, EndToken>
					: never
			: never
		: AfterOptionalWhere<Rw, ListResult, Distinct, From, undefined, EndToken>
	: never

type AfterOptionalWhere<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	WhereVal extends WhereConjunction | undefined,
	EndToken extends SelectStatementEnd,
> = ReadOptionalToken<Tokens, "order"> extends [infer Ro extends TokensList, infer HasOrder extends boolean]
	? HasOrder extends true
		? ReadExpectedToken<Ro, "by", "Expected BY after ORDER"> extends [infer Rob extends TokensList, infer ByOk]
			? ByOk extends true
				? ParseOrderByList<Rob> extends [infer Ro2 extends TokensList, infer OrderResult]
					? OrderResult extends SqlParserError<string>
						? [Ro2, OrderResult]
						: OrderResult extends readonly OrderByItem[]
							? AfterOptionalOrderBy<Ro2, ListResult, Distinct, From, WhereVal, OrderResult, EndToken>
							: never
					: never
				: [Rob, Extract<ByOk, SqlParserError<string>>]
			: never
		: AfterOptionalOrderBy<Ro, ListResult, Distinct, From, WhereVal, undefined, EndToken>
	: never

type AfterOptionalOrderBy<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	WhereVal extends WhereConjunction | undefined,
	OrderVal extends readonly OrderByItem[] | undefined,
	EndToken extends SelectStatementEnd,
> = ReadOptionalToken<Tokens, "limit"> extends [infer Rl extends TokensList, infer HasLim extends boolean]
	? HasLim extends true
		? ReadToken<Rl> extends [infer Rafter extends TokensList, infer Tok]
			? Tok extends TokenIdent<infer Lim extends string>
				? ParseLimitOffsetTail<Rafter, ListResult, Distinct, From, WhereVal, OrderVal, Lim, EndToken>
				: Tok extends TokenKey<infer Lim extends string>
					? Lim extends `${number}`
						? ParseLimitOffsetTail<Rafter, ListResult, Distinct, From, WhereVal, OrderVal, Lim, EndToken>
						: [Rafter, SqlParserError<"Expected LIMIT value">]
					: [Rafter, SqlParserError<"Expected LIMIT value">]
			: never
		: ParseLimitOffsetTail<Rl, ListResult, Distinct, From, WhereVal, OrderVal, undefined, EndToken>
	: never

type ParseLimitOffsetTail<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	WhereVal extends WhereConjunction | undefined,
	OrderVal extends readonly OrderByItem[] | undefined,
	LimitVal extends string | undefined,
	EndToken extends SelectStatementEnd,
> = ReadOptionalToken<Tokens, "offset"> extends [infer Ro extends TokensList, infer HasOff extends boolean]
	? HasOff extends true
		? ReadToken<Ro> extends [infer Rafter extends TokensList, infer Tok]
			? Tok extends TokenIdent<infer Off extends string>
				? FinalSelectSkip<Rafter, ListResult, Distinct, From, WhereVal, OrderVal, LimitVal, Off, EndToken>
				: Tok extends TokenKey<infer Off extends string>
					? Off extends `${number}`
						? FinalSelectSkip<Rafter, ListResult, Distinct, From, WhereVal, OrderVal, LimitVal, Off, EndToken>
						: [Rafter, SqlParserError<"Expected OFFSET value">]
					: [Rafter, SqlParserError<"Expected OFFSET value">]
			: never
		: FinalSelectSkip<Ro, ListResult, Distinct, From, WhereVal, OrderVal, LimitVal, undefined, EndToken>
	: never

type FinalSelectSkip<
	Tokens extends TokensList,
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	WhereVal extends WhereConjunction | undefined,
	OrderVal extends readonly OrderByItem[] | undefined,
	LimitVal extends string | undefined,
	OffsetVal extends string | undefined,
	EndToken extends SelectStatementEnd,
> = SkipStatement<Tokens, EndToken> extends [infer R4 extends TokensList, infer SkipResult]
	? SkipResult extends SkippedStatement
		? [
				R4,
				BuildSelectStatement<ListResult, Distinct, From, WhereVal, OrderVal, LimitVal, OffsetVal>,
			]
		: SkipResult extends SqlParserError<string>
			? [R4, SkipResult]
			: [R4, SqlParserError<"Internal SELECT tail skip">]
	: never

type BuildSelectStatement<
	ListResult extends "star" | readonly SelectColumn[],
	Distinct extends boolean,
	From extends FromClause,
	WhereVal extends WhereConjunction | undefined,
	OrderVal extends readonly OrderByItem[] | undefined,
	LimitVal extends string | undefined,
	OffsetVal extends string | undefined,
> = {
	kind: "select"
	distinct: Distinct
	columns: ListResult
	from: From
} & (undefined extends WhereVal ? {} : { where: WhereVal }) &
	(undefined extends OrderVal ? {} : { orderBy: OrderVal }) &
	(undefined extends LimitVal ? {} : { limit: LimitVal }) &
	(undefined extends OffsetVal ? {} : { offset: OffsetVal })

type ParseJoinsTail<Tokens extends TokensList, Acc extends JoinClause[]> = PeekToken<Tokens> extends infer P
	? P extends TokenKey<"left">
		? ReadJoinAfterLeft<SkipToken<Tokens>> extends [infer Rj extends TokensList, infer One]
			? One extends SqlParserError<string>
				? [Rj, One]
				: One extends JoinClause
					? ParseJoinsTail<Rj, [...Acc, One]>
					: never
			: never
		: P extends TokenKey<"inner">
			? ReadJoinAfterInner<SkipToken<Tokens>> extends [infer Rj extends TokensList, infer One]
				? One extends SqlParserError<string>
					? [Rj, One]
					: One extends JoinClause
						? ParseJoinsTail<Rj, [...Acc, One]>
						: never
				: never
			: P extends TokenKey<"join">
				? ReadJoinAfterBareJoin<SkipToken<Tokens>> extends [infer Rj extends TokensList, infer One]
					? One extends SqlParserError<string>
						? [Rj, One]
						: One extends JoinClause
							? ParseJoinsTail<Rj, [...Acc, One]>
							: never
					: never
				: [Tokens, Acc]
	: never

type ReadJoinAfterLeft<Tokens extends TokensList> = ReadExpectedToken<Tokens, "join", "Expected JOIN after LEFT"> extends [
	infer R1 extends TokensList,
	infer JOk,
]
	? JOk extends true
		? ReadQualifiedAndOn<R1, "left">
		: [R1, Extract<JOk, SqlParserError<string>>]
	: never

type ReadJoinAfterInner<Tokens extends TokensList> = ReadExpectedToken<Tokens, "join", "Expected JOIN after INNER"> extends [
	infer R1 extends TokensList,
	infer JOk,
]
	? JOk extends true
		? ReadQualifiedAndOn<R1, "inner">
		: [R1, Extract<JOk, SqlParserError<string>>]
	: never

type ReadJoinAfterBareJoin<Tokens extends TokensList> = ReadQualifiedAndOn<Tokens, "inner">

type ReadQualifiedAndOn<
	Tokens extends TokensList,
	Kind extends "inner" | "left",
> = ReadQualifiedIdentifierFromBuffer<Tokens> extends [infer Rt extends TokensList, infer Tab]
	? Tab extends SqlParserError<string>
		? [Rt, Tab]
		: Tab extends SqlQualifiedIdentifier
			? ReadExpectedToken<Rt, "on", "Expected ON after JOIN table"> extends [infer Ro extends TokensList, infer OnOk]
				? OnOk extends true
					? ParseWhereConjunction<Ro> extends [infer Ron extends TokensList, infer OnExpr]
						? OnExpr extends SqlParserError<string>
							? [Ron, OnExpr]
							: OnExpr extends WhereConjunction
								? [Ron, { kind: Kind; table: Tab; on: OnExpr }]
								: never
						: never
					: [Ro, Extract<OnOk, SqlParserError<string>>]
				: never
			: never
	: never

export type ParseColRef<Tokens extends TokensList> = PeekToken<Tokens> extends TokenIdent<infer A extends string>
	? ReadOptionalToken<SkipToken<Tokens>, "."> extends [infer R1 extends TokensList, infer HasDot extends boolean]
		? HasDot extends true
			? PeekToken<R1> extends TokenIdent<infer B extends string>
				? [SkipToken<R1>, { table: A; column: B }]
				: [R1, SqlParserError<"Expected column name after . in qualified reference">]
			: [R1, { column: A }]
		: never
	: [Tokens, SqlParserError<"Expected column reference">]

type ConcatWhereEqs<A extends readonly WhereEq[], B extends readonly WhereEq[]> = readonly [...A, ...B]

type ParseWhereConjunction<Tokens extends TokensList> = ParseWhereFactor<Tokens> extends [
	infer R1 extends TokensList,
	infer Part,
]
	? Part extends SqlParserError<string>
		? [R1, Part]
		: Part extends readonly WhereEq[]
			? ReadOptionalToken<R1, "and"> extends [infer R2 extends TokensList, infer HasAnd extends boolean]
				? HasAnd extends true
					? ParseWhereConjunction<R2> extends [infer R3 extends TokensList, infer Rest]
						? Rest extends SqlParserError<string>
							? [R3, Rest]
							: Rest extends readonly WhereEq[]
								? [R3, ConcatWhereEqs<Part, Rest>]
								: never
						: never
					: [R2, Part]
				: never
			: never
	: never

type ParseWhereFactor<Tokens extends TokensList> = PeekToken<Tokens> extends TokenKey<"(">
	? ParseWhereConjunction<SkipToken<Tokens>> extends [infer R0 extends TokensList, infer Inner]
		? Inner extends SqlParserError<string>
			? [R0, Inner]
			: Inner extends readonly WhereEq[]
				? ReadExpectedToken<R0, ")", "Expected ) after WHERE subexpression"> extends [infer R1 extends TokensList, infer POk]
					? POk extends true
						? [R1, Inner]
						: [R1, Extract<POk, SqlParserError<string>>]
					: never
				: never
		: never
	: ParseWhereEqExpr<Tokens> extends [infer R2 extends TokensList, infer E]
		? E extends SqlParserError<string>
			? [R2, E]
			: E extends WhereEq
				? [R2, readonly [E]]
				: never
		: never

type ParseWhereEqExpr<Tokens extends TokensList> = ParseWhereAtom<Tokens> extends [
	infer Ra extends TokensList,
	infer La,
]
	? La extends SqlParserError<string>
		? [Ra, La]
		: La extends WhereAtom
			? ReadExpectedToken<Ra, "=", "Expected = in WHERE"> extends [infer Rb extends TokensList, infer EqOk]
				? EqOk extends true
					? ParseWhereAtom<Rb> extends [infer Rc extends TokensList, infer Ra2]
						? Ra2 extends SqlParserError<string>
							? [Rc, Ra2]
							: Ra2 extends WhereAtom
								? [Rc, { kind: "eq"; left: La; right: Ra2 }]
								: never
							: never
					: [Rb, Extract<EqOk, SqlParserError<string>>]
				: never
			: never
	: never

type ParseWhereAtom<Tokens extends TokensList> = PeekToken<Tokens> extends TokenString<infer S extends string>
	? [SkipToken<Tokens>, { kind: "lit"; value: S }]
	: PeekToken<Tokens> extends TokenKey<infer K extends string>
		? K extends `${number}`
			? [SkipToken<Tokens>, { kind: "lit"; value: K }]
			: ParseColRef<Tokens> extends [infer R extends TokensList, infer C]
				? C extends SqlParserError<string>
					? [R, C]
					: C extends ColRef
						? [R, { kind: "col"; ref: C }]
						: never
				: never
		: ParseColRef<Tokens> extends [infer R extends TokensList, infer C]
			? C extends SqlParserError<string>
				? [R, C]
				: C extends ColRef
					? [R, { kind: "col"; ref: C }]
					: never
			: never

type ParseOrderByList<Tokens extends TokensList> = ParseOrderByItem<Tokens> extends [
	infer R extends TokensList,
	infer First,
]
	? First extends SqlParserError<string>
		? [R, First]
		: First extends OrderByItem
			? ParseOrderByListTail<R, [First]>
			: never
		: never

type ParseOrderByListTail<Tokens extends TokensList, Acc extends OrderByItem[]> = ReadOptionalToken<
	Tokens,
	","
> extends [infer R extends TokensList, infer HasComma extends boolean]
	? HasComma extends true
		? ParseOrderByItem<R> extends [infer R2 extends TokensList, infer Next]
			? Next extends SqlParserError<string>
				? [R2, Next]
				: Next extends OrderByItem
					? ParseOrderByListTail<R2, [...Acc, Next]>
					: never
				: never
		: [R, Acc]
	: never

type ParseOrderByItem<Tokens extends TokensList> = ParseColRef<Tokens> extends [
	infer R extends TokensList,
	infer Ref,
]
	? Ref extends SqlParserError<string>
		? [R, Ref]
		: Ref extends ColRef
			? OrderByAfterColRef<R, Ref>
			: never
		: never

type OrderByAfterColRef<R extends TokensList, Ref extends ColRef> = ReadOptionalToken<
	R,
	"asc"
> extends [infer R2 extends TokensList, infer HasAsc extends boolean]
	? HasAsc extends true
		? [R2, { ref: Ref; direction: "asc" }]
		: ReadOptionalToken<R2, "desc"> extends [infer R3 extends TokensList, infer HasDesc extends boolean]
			? HasDesc extends true
				? [R3, { ref: Ref; direction: "desc" }]
				: [R3, { ref: Ref }]
			: never
	: never

type ParseSelectList<Tokens extends TokensList> = PeekToken<Tokens> extends TokenKey<"*">
	? [SkipToken<Tokens>, "star"]
	: PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseOneSelectColumn<SkipToken<Tokens>, A> extends [infer R extends TokensList, infer Col extends SelectColumn]
			? ParseSelectColumnTail<R, [Col]>
			: never
		: [Tokens, SqlParserError<"Expected * or column name in SELECT list">]

type ParseOneSelectColumn<Tokens extends TokensList, Name extends string> = ReadOptionalToken<
	Tokens,
	"as"
> extends [infer R1 extends TokensList, infer HasAs extends boolean]
	? HasAs extends true
		? PeekToken<R1> extends TokenIdent<infer Alias extends string>
			? [SkipToken<R1>, { name: Name; as: Alias }]
			: [R1, SqlParserError<"Expected alias after AS in SELECT list">]
		: [R1, { name: Name }]
	: never

type ParseSelectColumnTail<Tokens extends TokensList, Acc extends SelectColumn[]> = ReadOptionalToken<
	Tokens,
	","
> extends [infer R extends TokensList, infer HasComma extends boolean]
	? HasComma extends true
		? PeekToken<R> extends TokenIdent<infer B extends string>
			? ParseOneSelectColumn<SkipToken<R>, B> extends [infer R2 extends TokensList, infer Col extends SelectColumn]
				? ParseSelectColumnTail<R2, [...Acc, Col]>
				: never
			: [R, SqlParserError<"Expected column name after , in SELECT list">]
		: [R, Acc]
	: never
