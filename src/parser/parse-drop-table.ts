import type { JsqlDatabaseShape, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"

export type ParseDropTable<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropTableQualified<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in DROP TABLE">]
			: never
		: ParseDropTableQualified<Tokens, Db, false>

/** True when `Tab` is already a concrete key of `sets` (not an open-ended index signature). */
type HasConcreteSet<Sets extends object, Tab extends string> = string extends keyof Sets
	? false
	: Tab extends keyof Sets
		? true
		: false

type SetEntry<
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"],
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? Tab extends keyof Db["schemas"][Sch]["sets"]
		? Db["schemas"][Sch]["sets"][Tab]
		: never
	: never

/** `DROP TABLE` may only remove a relation whose `kind` is `"table"`. */
type IsDroppableTableEntry<E> = E extends JsqlTableShape ? (E["kind"] extends "table" ? true : false) : false

/** After `schema.` in qualified `DROP TABLE schema.table`. */
type ParseDropQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	ReadToken<AfterDot> extends [infer R2 extends TokensList, infer T2]
		? T2 extends TokenIdent<infer B extends string>
			? ReadToken<R2> extends [infer R3 extends TokensList, infer T3]
				? T3 extends TokenKey<";"> | TokenEot
					? [R3, null, A, B]
					: [R3, SqlParserError<"Expected `;` after qualified table name in DROP TABLE">, never, never]
				: never
			: [R2, SqlParserError<"Expected table name after `.` in DROP TABLE">, never, never]
		: never

/** After first identifier (table or schema). */
type ParseDropAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	ReadToken<AfterFirst> extends [infer R1 extends TokensList, infer T1]
		? T1 extends TokenKey<";"> | TokenEot
			? [R1, null, Db["defaultSchema"], A]
			: T1 extends TokenKey<".">
				? ParseDropQualifiedSecondIdent<R1, A>
				: [R1, SqlParserError<"Expected `.` or end of table name in DROP TABLE">, never, never]
		: never

/** `[rest, null, schema, table]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTableNameForDrop<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterFirst extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer A extends string>
			? ParseDropAfterFirstIdent<AfterFirst, Db, A>
			: [AfterFirst, SqlParserError<"Expected table name in DROP TABLE">, never, never]
		: never

type ParseDropTableQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTableNameForDrop<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? Sch extends keyof Db["schemas"]
				? IfExists extends true
					? HasConcreteSet<Db["schemas"][Sch]["sets"], Tab> extends true
						? IsDroppableTableEntry<SetEntry<Db, Sch & keyof Db["schemas"], Tab>> extends true
							? RemoveTableFromDb<Db, Sch & keyof Db["schemas"], Tab> extends infer NewDb extends
									JsqlDatabaseShape
								? FinishDropStatement<R, NewDb>
								: never
							: FinishDropStatement<R, Db>
						: FinishDropStatement<R, Db>
					: HasConcreteSet<Db["schemas"][Sch]["sets"], Tab> extends true
						? IsDroppableTableEntry<SetEntry<Db, Sch & keyof Db["schemas"], Tab>> extends true
							? RemoveTableFromDb<Db, Sch & keyof Db["schemas"], Tab> extends infer NewDb extends
									JsqlDatabaseShape
								? FinishDropStatement<R, NewDb>
								: never
							: [R, Db, SqlParserError<"DROP TABLE targets a view; use DROP VIEW">]
						: [R, Db, SqlParserError<"Table does not exist; use IF EXISTS">]
				: [R, Db, SqlParserError<"Unknown schema for DROP TABLE">]
			: [R, Db, E extends SqlParserError<string> ? E : SqlParserError<"Invalid DROP TABLE parse">]
		: never

type FinishDropStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? [R1, Db, null]
			: [R1, Db, SqlParserError<"Expected `;` after DROP TABLE">]
		: never

type RemoveTableFromDb<
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"],
	Tab extends string,
> = Tab extends keyof Db["schemas"][Sch]["sets"]
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: {
				[K in keyof Db["schemas"]]: K extends Sch
					? { sets: Omit<Db["schemas"][Sch]["sets"], Tab> } & Omit<Db["schemas"][Sch], "sets">
					: Db["schemas"][K]
			}
		}
	: never
