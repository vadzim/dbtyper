import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTypeShape } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { ParseQualifiedName } from "./parse-qualified-name.ts"
import type { JsqlDbGetSchema, JsqlDbGetEnum, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseAlterType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseAlterTypeQualified<A1, Db, true>
					: never
				: SkipFailedExpression<A0, SqlParserError<"Expected `exists` after `IF` in ALTER TYPE">> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
			: never
		: ParseAlterTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `ALTER TYPE schema.type`. */
type ParseAlterQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends TokenIdent<infer B extends string>
		? [SkipToken<AfterDot>, null, A, B]
		: [AfterDot, SqlParserError<"Expected type name after `.` in ALTER TYPE">, never, never]

/** After first identifier (type or schema). */
type ParseAlterAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"add">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? ParseAlterQualifiedSecondIdent<SkipToken<AfterFirst>, A>
			: [AfterFirst, SqlParserError<"Expected `.` or `ADD` in ALTER TYPE">, never, never]

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForAlter<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: [Tokens, SqlParserError<"Expected type name in ALTER TYPE">, never, never]

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
								SqlParserError<"Type does not exist or is not an enum; use IF EXISTS">
						  > extends [infer Rest extends TokensList, infer Err]
						? [Rest, Db, Err]
						: never
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid ALTER TYPE parse">]
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
										SqlParserError<"Expected `value` after `ADD` in ALTER TYPE">
								  > extends [infer Rest extends TokensList, infer Err]
								? [Rest, Db, Err]
								: never
						: never
					: never
				: SkipFailedExpression<AfterAdd, SqlParserError<"Expected `add` in ALTER TYPE">> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
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
					? [AfterVal, Db, SqlParserError<"Enum value already exists">]
					: JsqlDbReplaceEnum<Db, Sch, Typ, readonly [...Values, NewValue]> extends infer NewDb extends
								JsqlDatabaseShape
						? ParseAlterTypeCloseSemi<AfterVal, NewDb>
						: never
				: SkipFailedExpression<
							AfterVal,
							SqlParserError<"Expected string literal for enum value in ALTER TYPE">
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: never

type ParseAlterTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: SkipFailedExpression<Tokens, SqlParserError<"Expected `;` after ALTER TYPE">> extends [
					infer Rest extends TokensList,
					infer Err,
			  ]
			? [Rest, NewDb, Err]
			: never
