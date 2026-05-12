import type { JsqlDatabaseShape, JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenKey, TokenString, TokensList } from "../lexer/sql-tokens.ts"
import type { DbtyperErrorShape, FormatError } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseQualifiedName } from "./parse-qualified-name.ts"
import type { JsqlDbGetSchema, JsqlDbGetType, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseCreateType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateTypeQualified<A2, Db, true>
							: never
						: SkipFailedExpression<
									A1,
									FormatError<"EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TYPE", []>
							  > extends [infer Rest extends TokensList, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_NOT_AFTER_IF_IN_CREATE_TYPE", []>>
			: never
		: ParseCreateTypeQualified<Tokens, Db, false>

type ParseCreateTypeQualifiedWhenSchKnown<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Typ extends string,
> =
	JsqlDbGetType<Db, Sch, Typ> extends null
		? ParseCreateTypeAsEnum<R, Db, Sch, Typ, IfNotExists>
		: IfNotExists extends true
			? ParseCreateTypeAsEnum<R, Db, Sch, Typ, true>
			: SkipFailedStatement<R, Db, FormatError<"TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS", []>>

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
		: SkipFailedStatement<R, Db, FormatError<"UNKNOWN_SCHEMA", [Sch, "CREATE TYPE"]>>

type ParseCreateTypeQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	ParseQualifiedName<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? ParseCreateTypeQualifiedWhenNameOk<R, Db, IfNotExists, Sch, Typ>
			: [R, Db, E extends DbtyperErrorShape ? E : FormatError<"INVALID_CREATE_TYPE_NAME_PARSE", []>]
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
								? JsqlDbGetType<Db, Schema, TypeName> extends null
									? ParseCreateTypeEnumBody<AfterEnum, Db, Schema, TypeName, []>
									: ParseCreateTypeSkipEnumBody<AfterEnum, Db>
								: ParseCreateTypeEnumBody<AfterEnum, Db, Schema, TypeName, []>
							: SkipFailedExpression<
										AfterEnum,
										FormatError<"EXPECTED_ENUM_AFTER_AS_IN_CREATE_TYPE", []>
								  > extends [infer Rest extends TokensList, infer Err]
								? [Rest, Db, Err]
								: never
						: never
					: never
				: SkipFailedExpression<AfterAs, FormatError<"EXPECTED_AS_AFTER_TYPE_NAME_IN_CREATE_TYPE", []>> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
			: never
		: never

type ParseCreateTypeSkipEnumBody<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends TokensList
			? OpenTok extends TokenKey<"(">
				? SkipToCloseParenAndSemi<AfterOpen, Db>
				: SkipFailedExpression<
							AfterOpen,
							FormatError<"EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE", []>
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
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
							: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_SEMICOLON", ["CREATE TYPE"]>>
						: never
					: never
				: Tok extends TokenEot
					? [R, Db, FormatError<"UNEXPECTED_END_IN_CREATE_TYPE_ENUM_BODY", []>]
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
				: SkipFailedExpression<
							AfterOpen,
							FormatError<"EXPECTED_OPEN_PAREN_BEFORE_ENUM_VALUES_IN_CREATE_TYPE", []>
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
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
						? [R, Db, FormatError<"EMPTY_ENUM_VALUES_LIST_IN_CREATE_TYPE", []>]
						: JsqlDbReplaceEnum<Db, Schema, TypeName, Stack> extends infer NewDb extends JsqlDatabaseShape
							? ParseCreateTypeCloseSemi<R, NewDb>
							: never
					: SkipFailedExpression<
								R,
								FormatError<"EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_CREATE_TYPE", []>
						  > extends [infer Rest extends TokensList, infer Err]
						? [Rest, Db, Err]
						: never
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
					: SkipFailedExpression<
								R,
								FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_ENUM_VALUE_IN_CREATE_TYPE", []>
						  > extends [infer Rest extends TokensList, infer Err]
						? [Rest, Db, Err]
						: never
			: never
		: never

type ParseCreateTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: SkipFailedStatement<Tokens, NewDb, FormatError<"EXPECTED_SEMICOLON", ["CREATE TYPE"]>>
