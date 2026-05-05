import type { JsqlDatabaseShape, JsqlTypeShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ParseQualifiedName } from "./parse-qualified-name.ts"

export type ParseDropType<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropTypeQualified<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in DROP TYPE">]
			: never
		: ParseDropTypeQualified<Tokens, Db, false>

/** True when `Typ` is already a concrete key of `types` (not only an open-ended index signature). */
type HasConcreteType<Types extends object | undefined, Typ extends string> = Types extends object
	? Typ extends keyof Types
		? true
		: false
	: false

type TypeEntry<
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"],
	Typ extends string,
> = Sch extends keyof Db["schemas"]
	? Db["schemas"][Sch]["types"] extends object
		? Typ extends keyof Db["schemas"][Sch]["types"]
			? Db["schemas"][Sch]["types"][Typ]
			: never
		: never
	: never

/** `DROP TYPE` may only remove a type entry. */
type IsDroppableTypeEntry<E> = E extends JsqlTypeShape ? true : false

/** After `schema.` in qualified `DROP TYPE schema.type`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? [R2, null, A, B]
				: [R2, SqlParserError<"Expected type name after `.` in DROP TYPE">, never, never]
			: never
		: never

/** After first identifier (type or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<";"> | TokenEot
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer T1
			? SkipToken<AfterFirst> extends infer R1 extends TokensList
				? T1 extends TokenKey<".">
					? ParseDropQualifiedSecondIdent<R1, A>
					: [R1, SqlParserError<"Expected `.` or `;` after type name in DROP TYPE">, never, never]
				: never
			: never

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseDropAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected type name in DROP TYPE">, never, never]
			: never
		: never

type ParseDropTypeQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTypeNameForDrop<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? Sch extends keyof Db["schemas"]
				? IfExists extends true
					? HasConcreteType<Db["schemas"][Sch]["types"], Typ> extends true
						? IsDroppableTypeEntry<TypeEntry<Db, Sch & keyof Db["schemas"], Typ>> extends true
							? RemoveTypeFromDb<Db, Sch & keyof Db["schemas"], Typ> extends infer NewDb extends
									JsqlDatabaseShape
								? FinishDropStatement<R, NewDb>
								: never
							: FinishDropStatement<R, Db>
						: FinishDropStatement<R, Db>
					: HasConcreteType<Db["schemas"][Sch]["types"], Typ> extends true
						? IsDroppableTypeEntry<TypeEntry<Db, Sch & keyof Db["schemas"], Typ>> extends true
							? RemoveTypeFromDb<Db, Sch & keyof Db["schemas"], Typ> extends infer NewDb extends
									JsqlDatabaseShape
								? FinishDropStatement<R, NewDb>
								: never
							: [R, Db, SqlParserError<"Type does not exist or is not droppable">]
						: [R, Db, SqlParserError<"Type does not exist; use IF EXISTS">]
				: [R, Db, SqlParserError<"Unknown schema for DROP TYPE">]
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid DROP TYPE parse">]
		: never

type FinishDropStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? [R1, Db, null]
				: [R1, Db, SqlParserError<"Expected `;` after DROP TYPE">]
			: never
		: never

type RemoveTypeFromDb<
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"],
	Typ extends string,
> = Db["schemas"][Sch]["types"] extends object
	? Typ extends keyof Db["schemas"][Sch]["types"]
		? {
				defaultSchema: Db["defaultSchema"]
				schemas: {
					[K in keyof Db["schemas"]]: K extends Sch
						? { types: Omit<Db["schemas"][Sch]["types"], Typ> } & Omit<Db["schemas"][Sch], "types">
						: Db["schemas"][K]
				}
			}
		: never
	: never
