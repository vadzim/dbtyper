import type {
	I,
	JsqlDatabaseShape,
	JsqlSchemaShape,
	JsqlTypeShape,
	JsqlGetSchema,
	JsqlGetType,
} from "../core/jsql-shapes.ts"
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

type TypeEntry<Db extends JsqlDatabaseShape, Sch extends string, Typ extends string> = JsqlGetType<
	JsqlGetSchema<Db, Sch>,
	Typ
>

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
			? JsqlGetSchema<Db, Sch> extends infer Schema extends JsqlSchemaShape
				? IfExists extends true
					? JsqlGetType<Schema, Typ> extends infer Entry extends JsqlTypeShape
						? Sch extends keyof Db["schemas"]
							? ParseAlterTypeAction<R, Db, Sch, Typ, Entry>
							: never
						: [R, Db, null]
					: JsqlGetType<Schema, Typ> extends infer Entry extends JsqlTypeShape
						? Sch extends keyof Db["schemas"]
							? ParseAlterTypeAction<R, Db, Sch, Typ, Entry>
							: never
						: [R, Db, SqlParserError<"Type does not exist; use IF EXISTS">]
				: [R, Db, SqlParserError<"Unknown schema for ALTER TYPE">]
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid ALTER TYPE parse">]
		: never

type ParseAlterTypeAction<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Entry extends JsqlTypeShape,
> =
	PeekToken<Tokens> extends infer AddTok
		? SkipToken<Tokens> extends infer AfterAdd extends TokensList
			? AddTok extends TokenKey<"add">
				? PeekToken<AfterAdd> extends infer ValueTok
					? SkipToken<AfterAdd> extends infer AfterValue extends TokensList
						? ValueTok extends TokenIdent<"value">
							? ParseAlterTypeAddValue<AfterValue, Db, Sch, Typ, Entry>
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
	Entry extends JsqlTypeShape,
> =
	PeekToken<Tokens> extends infer ValTok
		? SkipToken<Tokens> extends infer AfterVal extends TokensList
			? ValTok extends TokenString<infer NewValue extends string>
				? Entry extends { kind: "enum"; values: infer Values extends readonly string[] }
					? NewValue extends Values[number]
						? [AfterVal, Db, SqlParserError<"Enum value already exists">]
						: UpdateTypeInDb<Db, Sch, Typ, readonly [...Values, NewValue]> extends infer NewDb extends
									JsqlDatabaseShape
							? ParseAlterTypeCloseSemi<AfterVal, NewDb>
							: never
					: [AfterVal, Db, SqlParserError<"Type is not an enum">]
				: [AfterVal, Db, SqlParserError<"Expected string literal for enum value in ALTER TYPE">]
			: never
		: never

type ParseAlterTypeCloseSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? [R, NewDb, null]
				: [R, NewDb, SqlParserError<"Expected `;` after ALTER TYPE">]
			: never
		: never

type UpdateTypeInDb<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	NewValues extends readonly string[],
> =
	JsqlGetSchema<Db, Sch> extends infer Schema extends JsqlSchemaShape
		? JsqlGetType<Schema, Typ> extends object
			? Sch extends keyof Db["schemas"]
				? {
						defaultSchema: Db["defaultSchema"]
						schemas: {
							[K in keyof Db["schemas"]]: K extends Sch
								? {
										types: {
											[T in keyof I<
												I<Db, "schemas", {}>,
												Sch & keyof Db["schemas"],
												JsqlSchemaShape
											>["types"]]: T extends Typ
												? { kind: "enum"; values: NewValues }
												: I<
														I<Db, "schemas", {}>,
														Sch & keyof Db["schemas"],
														JsqlSchemaShape
													>["types"][T]
										}
									} & Omit<
										I<I<Db, "schemas", {}>, Sch & keyof Db["schemas"], JsqlSchemaShape>,
										"types"
									>
								: Db["schemas"][K]
						}
					}
				: never
			: never
		: never
