import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { DbtyperError, FormatError } from "../sql-parser-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { JsqlDbGetEnum, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseAlterType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseAlterTypeQualified<A1, Db, true>
					: never
				: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE", []>>
			: never
		: ParseAlterTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `ALTER TYPE schema.type`. */
type ParseAlterQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends TokenIdent<infer B extends string>
		? [SkipToken<AfterDot>, null, A, B]
		: SkipFailedQualifiedName<AfterDot, FormatError<"EXPECTED_TYPE_NAME_AFTER_DOT_IN_ALTER_TYPE", []>>

/** After first identifier (type or schema). */
type ParseAlterAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"add">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? ParseAlterQualifiedSecondIdent<SkipToken<AfterFirst>, A>
			: SkipFailedQualifiedName<AfterFirst, FormatError<"EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE", []>>

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForAlter<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: SkipFailedQualifiedName<Tokens, FormatError<"EXPECTED_TYPE_NAME_IN_ALTER_TYPE", []>>

type ParseAlterTypeQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTypeNameForAlter<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? IfExists extends true
				? JsqlDbGetEnum<Db, Sch, Typ> extends infer Values extends readonly string[]
					? ParseAlterTypeAction<R, Db, Sch, Typ, Values>
					: [R, Db, null]
			: JsqlDbGetEnum<Db, Sch, Typ> extends infer Values extends readonly string[]
				? ParseAlterTypeAction<R, Db, Sch, Typ, Values>
				: SkipFailedExpression<
							R,
							FormatError<"TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS", []>
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
			: [R, Db, E extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string> ? E : FormatError<"INVALID_ALTER_TYPE_PARSE", []>]
		: never

type ParseAlterTypeAction<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
> =
	PeekToken<Tokens> extends infer AddTok
		? SkipToken<Tokens> extends infer AfterAdd extends TokensList
			? AddTok extends TokenKey<"add">
				? PeekToken<AfterAdd> extends infer ValueTok
					? SkipToken<AfterAdd> extends infer AfterValue extends TokensList
						? ValueTok extends TokenIdent<"value">
							? ParseAlterTypeAddValue<AfterValue, Db, Sch, Typ, Values>
							: SkipFailedExpression<
										AfterValue,
										FormatError<"EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE", []>
								  > extends [infer Rest extends TokensList, infer Err]
								? [Rest, Db, Err]
								: never
						: never
					: never
				: SkipFailedStatement<AfterAdd, Db, FormatError<"EXPECTED_ADD_IN_ALTER_TYPE", []>>
			: never
		: never

type ParseAlterTypeAddValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
> =
	PeekToken<Tokens> extends infer ValTok
		? SkipToken<Tokens> extends infer AfterVal extends TokensList
			? ValTok extends TokenString<infer NewValue extends string>
				? NewValue extends Values[number]
					? [AfterVal, Db, FormatError<"ENUM_VALUE_ALREADY_EXISTS", []>]
					: JsqlDbReplaceEnum<Db, Sch, Typ, readonly [...Values, NewValue]> extends infer NewDb extends
							JsqlDatabaseShape
						? ParseAlterTypeCloseSemi<AfterVal, NewDb>
						: never
				: SkipFailedExpression<
						AfterVal,
						FormatError<"EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE", []>
				  > extends [infer Rest extends TokensList, infer Err]
				? [Rest, Db, Err]
				: never
			: never
		: never

type ParseAlterTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: SkipFailedStatement<Tokens, NewDb, FormatError<"EXPECTED_SEMICOLON_AFTER_ALTER_TYPE", []>>
