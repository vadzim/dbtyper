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
import type { ParseQualifiedName } from "./parse-qualified-name.ts"
import type { JsqlDbGetSchema, JsqlDbGetEnum, JsqlSchemaGetEnum, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseAlterType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseAlterTypeQualified<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in ALTER TYPE">]
			: never
		: ParseAlterTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `ALTER TYPE schema.type`. */
type ParseAlterQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? [R2, null, A, B]
				: [R2, SqlParserError<"Expected type name after `.` in ALTER TYPE">, never, never]
			: never
		: never

/** After first identifier (type or schema). */
type ParseAlterAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"add">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer T1
			? SkipToken<AfterFirst> extends infer R1 extends TokensList
				? T1 extends TokenKey<".">
					? ParseAlterQualifiedSecondIdent<R1, A>
					: [R1, SqlParserError<"Expected `.` or `ADD` in ALTER TYPE">, never, never]
				: never
			: never

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForAlter<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseAlterAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected type name in ALTER TYPE">, never, never]
			: never
		: never

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
					: [R, Db, SqlParserError<"Type does not exist or is not an enum; use IF EXISTS">]
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
							: [AfterValue, Db, SqlParserError<"Expected `value` after `ADD` in ALTER TYPE">]
						: never
					: never
				: [AfterAdd, Db, SqlParserError<"Expected `add` in ALTER TYPE">]
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
				: [AfterVal, Db, SqlParserError<"Expected string literal for enum value in ALTER TYPE">]
			: never
		: never

type ParseAlterTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: [SkipToken<Tokens>, NewDb, SqlParserError<"Expected `;` after ALTER TYPE">]
