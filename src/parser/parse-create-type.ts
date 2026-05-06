import type { JsqlDatabaseShape, JsqlSchemaShape } from "../core/jsql-shapes.ts"
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
import type { JsqlDbGetSchema, JsqlSchemaGetType, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseCreateType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateTypeQualified<A2, Db, true>
							: never
						: [A1, Db, SqlParserError<"Expected `exists` after `IF NOT` in CREATE TYPE">]
					: never
				: [A0, Db, SqlParserError<"Expected `not` after `IF` in CREATE TYPE">]
			: never
		: ParseCreateTypeQualified<Tokens, Db, false>

type ParseCreateTypeQualifiedWhenSchKnown<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Typ extends string,
> =
	JsqlSchemaGetType<JsqlDbGetSchema<Db, Sch>, Typ> extends null
		? ParseCreateTypeAsEnum<R, Db, Sch, Typ, IfNotExists>
		: IfNotExists extends true
			? ParseCreateTypeAsEnum<R, Db, Sch, Typ, true>
			: [R, Db, SqlParserError<"Type already exists; use IF NOT EXISTS">]

type ParseCreateTypeQualifiedWhenNameOk<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends string,
	Typ extends string,
> =
	JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
		? Sch extends keyof Db["schemas"]
			? ParseCreateTypeQualifiedWhenSchKnown<R, Db, IfNotExists, Sch & keyof Db["schemas"] & string, Typ>
			: never
		: [R, Db, SqlParserError<"Unknown schema for CREATE TYPE">]

type ParseCreateTypeQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	ParseQualifiedName<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? ParseCreateTypeQualifiedWhenNameOk<R, Db, IfNotExists, Sch, Typ>
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid CREATE TYPE name parse">]
		: never

type ParseCreateTypeAsEnum<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	IfNotExists extends boolean,
> =
	PeekToken<Tokens> extends infer AsTok
		? SkipToken<Tokens> extends infer AfterAs extends TokensList
			? AsTok extends TokenKey<"as">
				? PeekToken<AfterAs> extends infer EnumTok
					? SkipToken<AfterAs> extends infer AfterEnum extends TokensList
						? EnumTok extends TokenKey<"enum">
							? IfNotExists extends true
								? JsqlSchemaGetType<JsqlDbGetSchema<Db, Schema>, TypeName> extends null
									? ParseCreateTypeEnumBody<AfterEnum, Db, Schema, TypeName, []>
									: ParseCreateTypeSkipEnumBody<AfterEnum, Db>
								: ParseCreateTypeEnumBody<AfterEnum, Db, Schema, TypeName, []>
							: [AfterEnum, Db, SqlParserError<"Expected `enum` after `AS` in CREATE TYPE">]
						: never
					: never
				: [AfterAs, Db, SqlParserError<"Expected `as` after type name in CREATE TYPE">]
			: never
		: never

type ParseCreateTypeSkipEnumBody<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends TokensList
			? OpenTok extends TokenKey<"(">
				? SkipToCloseParenAndSemi<AfterOpen, Db>
				: [AfterOpen, Db, SqlParserError<"Expected `(` before enum values in CREATE TYPE">]
			: never
		: never

type SkipToCloseParenAndSemi<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R extends TokensList
			? Tok extends TokenKey<")">
				? PeekToken<R> extends infer Tok2
					? SkipToken<R> extends infer R2 extends TokensList
						? Tok2 extends TokenKey<";"> | TokenEot
							? [R2, Db, null]
							: [R2, Db, SqlParserError<"Expected `;` after CREATE TYPE">]
						: never
					: never
				: Tok extends TokenEot
					? [R, Db, SqlParserError<"Unexpected end in CREATE TYPE enum body">]
					: SkipToCloseParenAndSemi<R, Db>
			: never
		: never

type ParseCreateTypeEnumBody<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	Stack extends readonly string[],
> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends TokensList
			? OpenTok extends TokenKey<"(">
				? ParseEnumValues<AfterOpen, Db, Schema, TypeName, Stack>
				: [AfterOpen, Db, SqlParserError<"Expected `(` before enum values in CREATE TYPE">]
			: never
		: never

type ParseEnumValues<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	Stack extends readonly string[],
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R extends TokensList
			? Tok extends TokenString<infer Val extends string>
				? ParseAfterEnumValue<R, Db, Schema, TypeName, readonly [...Stack, Val]>
				: Tok extends TokenKey<")">
					? Stack extends readonly []
						? [R, Db, SqlParserError<"Empty enum values list in CREATE TYPE">]
						: JsqlDbReplaceEnum<Db, Schema, TypeName, Stack> extends infer NewDb extends JsqlDatabaseShape
							? ParseCreateTypeCloseSemi<R, NewDb>
							: never
					: [R, Db, SqlParserError<"Expected string literal for enum value in CREATE TYPE">]
			: never
		: never

type ParseAfterEnumValue<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	Stack extends readonly string[],
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R extends TokensList
			? Tok extends TokenKey<",">
				? ParseEnumValues<R, Db, Schema, TypeName, Stack>
				: Tok extends TokenKey<")">
					? JsqlDbReplaceEnum<Db, Schema, TypeName, Stack> extends infer NewDb extends JsqlDatabaseShape
						? ParseCreateTypeCloseSemi<R, NewDb>
						: never
					: [R, Db, SqlParserError<"Expected `,` or `)` after enum value in CREATE TYPE">]
			: never
		: never

type ParseCreateTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: [SkipToken<Tokens>, NewDb, SqlParserError<"Expected `;` after CREATE TYPE">]
