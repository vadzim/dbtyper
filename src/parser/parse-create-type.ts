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
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ParseQualifiedName } from "./parse-qualified-name.ts"

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

/** True when `Typ` is already a concrete key of `types` (not an open-ended index signature). */
type HasConcreteType<Types extends object | undefined, Typ extends string> = Types extends object
	? Typ extends keyof Types
		? true
		: false
	: false

/**
 * True when `Sch` is a real schema key on this DB (not satisfied only by an open `schemas` index signature).
 */
type HasConcreteSchemaKey<Db extends JsqlDatabaseShape, Sch extends string> = string extends keyof Db["schemas"]
	? false
	: Sch extends keyof Db["schemas"]
		? true
		: false

type ParseCreateTypeQualifiedWhenSchKnown<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Typ extends string,
> =
	HasConcreteType<Db["schemas"][Sch]["types"], Typ> extends true
		? IfNotExists extends true
			? ParseCreateTypeAsEnum<R, Db, Sch, Typ, true>
			: [R, Db, SqlParserError<"Type already exists; use IF NOT EXISTS">]
		: ParseCreateTypeAsEnum<R, Db, Sch, Typ, IfNotExists>

type ParseCreateTypeQualifiedWhenNameOk<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends string,
	Typ extends string,
> =
	HasConcreteSchemaKey<Db, Sch> extends true
		? ParseCreateTypeQualifiedWhenSchKnown<R, Db, IfNotExists, Sch & keyof Db["schemas"] & string, Typ>
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
								? HasConcreteType<
										Db["schemas"][Schema & keyof Db["schemas"]]["types"],
										TypeName
									> extends true
									? ParseCreateTypeSkipEnumBody<AfterEnum, Db>
									: ParseCreateTypeEnumBody<AfterEnum, Db, Schema, TypeName, []>
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
						: MergeTypeIntoDb<Db, Schema, TypeName, Stack> extends infer NewDb extends JsqlDatabaseShape
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
					? MergeTypeIntoDb<Db, Schema, TypeName, Stack> extends infer NewDb extends JsqlDatabaseShape
						? ParseCreateTypeCloseSemi<R, NewDb>
						: never
					: [R, Db, SqlParserError<"Expected `,` or `)` after enum value in CREATE TYPE">]
			: never
		: never

type ParseCreateTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? [R, NewDb, null]
				: [R, NewDb, SqlParserError<"Expected `;` after CREATE TYPE">]
			: never
		: never

type MergeTypeIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	TypeName extends string,
	Values extends readonly string[],
> = Schema extends keyof Db["schemas"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Schema
					? {
							types: (Db["schemas"][K]["types"] extends object ? Db["schemas"][K]["types"] : {}) &
								Record<TypeName, { kind: "enum"; values: Values }>
						} & Omit<Db["schemas"][K], "types">
					: Db["schemas"][K]
			}
		}
	: never
