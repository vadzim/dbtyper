import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape, JsqlColumnFactsEntry } from "../core/jsql-shapes.ts"
import type { I } from "../core/type-utils.ts"
import type { JsqlGetSchema, JsqlGetSet, JsqlGetTable } from "../core/jsql-utils.ts"
import type { ReplaceTableInDb } from "../core/jsql-utils-legacy.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { CollectSqlTypeWords, TypeWordsToString } from "./parse-sql-type-words.ts"

/** Helper to distribute over unions/intersections and extract the non-Record part */
type ExtractConcreteTableType<T, Tab extends string> =
	T extends Record<Tab, infer U>
		? U extends JsqlTableShape
			? [U] extends [JsqlTableShape]
				? U
				: never
			: never
		: never

/** Extract the table type from Sets by checking if Tab is assignable to a key. */
type ExtractTableType<Sets, Tab extends string> = ExtractConcreteTableType<Sets, Tab>

/** `sets[Tab]` can widen with `& { [K: string]: JsqlTableShape }`; narrow to a concrete base table. */
type AlterTableShapeAt<Sets extends object, Tab extends string> =
	ExtractTableType<Sets, Tab> extends infer T
		? T extends JsqlTableShape
			? T["kind"] extends "table"
				? T
				: never
			: never
		: never

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : unknown
}

type MergeStringRecords<A extends Record<string, string>, B extends Record<string, string>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : string
}

/** Skip until `,` or `;` at paren depth 0 (for `SET DEFAULT …` and similar no-ops). */
type SkipUntilCommaOrSemi<Tokens extends TokensList, Stack extends readonly unknown[] = []> =
	PeekToken<Tokens> extends TokenEot | TokenKey<";">
		? [Tokens, null]
		: PeekToken<Tokens> extends TokenKey<",">
			? Stack extends readonly []
				? [Tokens, null]
				: SkipUntilCommaOrSemi<SkipToken<Tokens>, Stack>
			: PeekToken<Tokens> extends TokenKey<"(">
				? SkipUntilCommaOrSemi<SkipToken<Tokens>, [...Stack, unknown]>
				: PeekToken<Tokens> extends TokenKey<")">
					? Stack extends readonly [unknown, ...infer Rest extends unknown[]]
						? SkipUntilCommaOrSemi<SkipToken<Tokens>, Rest>
						: SkipUntilCommaOrSemi<SkipToken<Tokens>, Stack>
					: SkipUntilCommaOrSemi<SkipToken<Tokens>, Stack>

type ParseAlterAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? SkipToken<AfterFirst> extends infer Rd1 extends TokensList
			? PeekToken<Rd1> extends infer T2
				? SkipToken<Rd1> extends infer R2 extends TokensList
					? T2 extends TokenIdent<infer B extends string>
						? [R2, null, A, B]
						: [R2, SqlParserError<"Expected table name after `.` in ALTER TABLE">, never, never]
					: never
				: never
			: never
		: [AfterFirst, null, Db["defaultSchema"], A]

type ParseQualifiedAlterTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseAlterAfterFirstIdent<AfterFirst, Db, A>
				: [AfterFirst, SqlParserError<"Expected table name in ALTER TABLE">, never, never]
			: never
		: never

type ApplyAddColumn<T extends JsqlTableShape, Col extends string, Sql extends string> = Col extends keyof T["columns"]
	? SqlParserError<"Column already exists">
	: {
			kind: T["kind"]
			columns: MergeRecords<T["columns"], Record<Col, Sql>>
			constraints?: T["constraints"]
			column_facts?: T["column_facts"]
		} & JsqlTableShape

type ApplyDropColumn<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? {
			kind: T["kind"]
			columns: Omit<T["columns"], Col>
			constraints?: T["constraints"]
			column_facts: T["column_facts"] extends infer F
				? F extends Record<string, JsqlColumnFactsEntry>
					? Omit<F, Col>
					: F
				: undefined
		} & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ApplyRenameColumn<
	T extends JsqlTableShape,
	Old extends string,
	New extends string,
> = Old extends keyof T["columns"]
	? New extends keyof T["columns"]
		? SqlParserError<"Column already exists">
		: {
				kind: T["kind"]
				columns: MergeRecords<Omit<T["columns"], Old>, Record<New, T["columns"][Old]>>
				constraints?: T["constraints"]
				column_facts: T["column_facts"] extends infer F
					? F extends Record<string, JsqlColumnFactsEntry>
						? Old extends keyof F
							? MergeRecords<Omit<F, Old>, Record<New, F[Old]>>
							: F
						: F
					: undefined
			} & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ApplyAlterColumnType<
	T extends JsqlTableShape,
	Col extends string,
	Sql extends string,
> = Col extends keyof T["columns"]
	? {
			kind: T["kind"]
			columns: MergeRecords<T["columns"], Record<Col, Sql>>
			constraints?: T["constraints"]
			column_facts?: T["column_facts"]
		} & JsqlTableShape
	: SqlParserError<"Column does not exist">

type MergeColFactPatch<
	T extends JsqlTableShape,
	Col extends string,
	Patch extends JsqlColumnFactsEntry,
> = T["column_facts"] extends infer F
	? F extends Record<string, JsqlColumnFactsEntry>
		? Col extends keyof F
			? MergeRecords<F, Record<Col, Omit<F[Col], keyof Patch> & Patch>>
			: MergeRecords<F, Record<Col, Patch>>
		: Record<Col, Patch>
	: Record<Col, Patch>

type ApplySetNotNull<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? Omit<T, "column_facts"> & {
			column_facts: MergeColFactPatch<T, Col, { nullability: "not_null" }>
		} & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ApplyDropNotNull<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? Omit<T, "column_facts"> & {
			column_facts: MergeColFactPatch<T, Col, { nullability: "nullable" }>
		} & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ParseAlterOptionalNullSuffix<Tokens extends TokensList, Joined extends string> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"null">
				? SkipToken<R1> extends infer R2 extends TokensList
					? [R2, Joined]
					: never
				: [R1, Joined]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? SkipToken<Tokens> extends infer Rn extends TokensList
				? [Rn, Joined]
				: never
			: [Tokens, Joined]

type ParseAlterAddColumnAfterColName<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	CollectSqlTypeWords<R2> extends [infer AfterType extends TokensList, infer Words extends readonly string[]]
		? TypeWordsToString<Words> extends infer Joined extends string
			? Joined extends ""
				? [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
				: ParseAlterOptionalNullSuffix<AfterType, Joined> extends [
							infer R3 extends TokensList,
							infer J2 extends string,
					  ]
					? ApplyAddColumn<Tbl, Col, J2> extends infer U
						? U extends SqlParserError<string>
							? [R3, Db, U]
							: U extends JsqlTableShape
								? ParseAlterActions<R3, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
								: never
						: never
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type FinishAlterStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? [R1, Db, null]
				: [R1, Db, SqlParserError<"Expected `;` after ALTER TABLE">]
			: never
		: never

type ParseAlterActions<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? FinishAlterStatement<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<",">
			? ParseAlterActions<SkipToken<Tokens>, Db, Sch, Tab>
			: ParseAlterOneAction<Tokens, Db, Sch, Tab>

type ParseAlterAfterOptionalColumnKw<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"column">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? [R1, null]
			: never
		: [Tokens, null]

type ParseAlterAddColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	PeekToken<Tokens> extends TokenKey<"add">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends
					| TokenKey<"constraint">
					| TokenKey<"primary">
					| TokenKey<"unique">
					| TokenKey<"foreign">
				? SkipUntilCommaOrSemi<R0> extends [infer Rskip extends TokensList, null]
					? ParseAlterActions<Rskip, Db, Sch, Tab>
					: never
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
					? PeekToken<R1> extends infer Tcol
						? SkipToken<R1> extends infer R2 extends TokensList
							? Tcol extends TokenIdent<infer Col extends string>
								? ParseAlterAddColumnAfterColName<R2, Db, Sch, Tab, Tbl, Col>
								: [R2, Db, SqlParserError<"Expected column name after ADD in ALTER TABLE">]
							: never
						: never
					: never
			: never
		: never

type ParseAlterDropColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	PeekToken<Tokens> extends TokenKey<"drop">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends TokenKey<"column">
				? SkipToken<R0> extends infer R1 extends TokensList
					? PeekToken<R1> extends infer Tcol
						? SkipToken<R1> extends infer R2 extends TokensList
							? Tcol extends TokenIdent<infer Col extends string>
								? ApplyDropColumn<Tbl, Col> extends infer U
									? U extends SqlParserError<string>
										? [R2, Db, U]
										: U extends JsqlTableShape
											? ParseAlterActions<R2, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
											: never
									: never
								: [R2, Db, SqlParserError<"Expected column name after DROP COLUMN">]
							: never
						: never
					: never
				: PeekToken<R0> extends TokenIdent<infer Col2 extends string>
					? SkipToken<R0> extends infer R1b extends TokensList
						? ApplyDropColumn<Tbl, Col2> extends infer U2
							? U2 extends SqlParserError<string>
								? [R1b, Db, U2]
								: U2 extends JsqlTableShape
									? ParseAlterActions<R1b, ReplaceTableInDb<Db, Sch, Tab, U2>, Sch, Tab>
									: never
							: never
						: never
					: never
			: never
		: never

type ParseAlterRenameAfterToKw<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Old extends string,
> =
	PeekToken<R2> extends infer Tto
		? SkipToken<R2> extends infer R3 extends TokensList
			? Tto extends TokenKey<"to">
				? PeekToken<R3> extends infer Tnew
					? SkipToken<R3> extends infer R4 extends TokensList
						? Tnew extends TokenIdent<infer New extends string>
							? ApplyRenameColumn<Tbl, Old, New> extends infer U
								? U extends SqlParserError<string>
									? [R4, Db, U]
									: U extends JsqlTableShape
										? ParseAlterActions<R4, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
										: never
								: never
							: [R4, Db, SqlParserError<"Expected new column name after TO in RENAME COLUMN">]
						: never
					: never
				: [R3, Db, SqlParserError<"Expected TO in RENAME COLUMN">]
			: never
		: never

type ParseAlterRenameAfterOldIdent<
	R2 extends TokensList,
	Told,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	Told extends TokenIdent<infer Old extends string>
		? PeekToken<R2> extends TokenKey<"to">
			? ParseAlterRenameAfterToKw<R2, Db, Sch, Tab, Tbl, Old>
			: [R2, Db, SqlParserError<"Expected TO in RENAME COLUMN">]
		: [R2, Db, SqlParserError<"Expected old column name in RENAME COLUMN">]

type ParseAlterRenameColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	PeekToken<Tokens> extends TokenKey<"rename">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
				? PeekToken<R1> extends infer Told
					? SkipToken<R1> extends infer R2 extends TokensList
						? ParseAlterRenameAfterOldIdent<R2, Told, Db, Sch, Tab, Tbl>
						: never
					: never
				: never
			: never
		: never

type ParseAlterColumnTypeAfterTypeKw<
	R3 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	CollectSqlTypeWords<R3> extends [infer AfterType extends TokensList, infer Words extends readonly string[]]
		? TypeWordsToString<Words> extends infer Joined extends string
			? Joined extends ""
				? [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
				: ParseAlterOptionalNullSuffix<AfterType, Joined> extends [
							infer R4 extends TokensList,
							infer J2 extends string,
					  ]
					? ApplyAlterColumnType<Tbl, Col, J2> extends infer U
						? U extends SqlParserError<string>
							? [R4, Db, U]
							: U extends JsqlTableShape
								? ParseAlterActions<R4, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
								: never
						: never
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type ParseAlterColumnTypeBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<R2> extends infer Tkw
		? SkipToken<R2> extends infer R3 extends TokensList
			? Tkw extends TokenKey<"type"> | TokenIdent<"type">
				? ParseAlterColumnTypeAfterTypeKw<R3, Db, Sch, Tab, Tbl, Col>
				: never
			: never
		: never

type ParseAlterColumnSetBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"set">
		? SkipToken<R2> extends infer Rs extends TokensList
			? PeekToken<Rs> extends TokenKey<"not">
				? SkipToken<Rs> extends infer Rn extends TokensList
					? PeekToken<Rn> extends infer TkNull
						? SkipToken<Rn> extends infer Rnn extends TokensList
							? TkNull extends TokenKey<"null">
								? ApplySetNotNull<Tbl, Col> extends infer U
									? U extends SqlParserError<string>
										? [Rnn, Db, U]
										: U extends JsqlTableShape
											? ParseAlterActions<Rnn, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
											: never
									: never
								: [Rnn, Db, SqlParserError<"Expected NULL after SET NOT">]
							: never
						: never
					: never
				: PeekToken<Rs> extends TokenKey<"default">
					? SkipToken<Rs> extends infer Rd extends TokensList
						? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends TokensList, null]
							? ParseAlterActions<Rsd, Db, Sch, Tab>
							: never
						: never
					: [Rs, Db, SqlParserError<"Unsupported ALTER COLUMN SET clause">]
			: never
		: never

type ParseAlterColumnDropNotNullChain<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? SkipToken<Rd0> extends infer Rd1 extends TokensList
			? PeekToken<Rd1> extends infer Tk2
				? SkipToken<Rd1> extends infer Rd2 extends TokensList
					? Tk2 extends TokenKey<"null">
						? ApplyDropNotNull<Tbl, Col> extends infer U
							? U extends SqlParserError<string>
								? [Rd2, Db, U]
								: U extends JsqlTableShape
									? ParseAlterActions<Rd2, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
									: never
							: never
						: [Rd2, Db, SqlParserError<"Expected NULL after DROP NOT">]
					: never
				: never
			: never
		: never

type ParseAlterColumnDropDefaultNoop<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<Rd0> extends infer Tdd
		? SkipToken<Rd0> extends infer Rdd extends TokensList
			? Tdd extends TokenKey<"default">
				? SkipUntilCommaOrSemi<Rdd> extends [infer Rsdd extends TokensList, null]
					? ParseAlterActions<Rsdd, Db, Sch, Tab>
					: never
				: [Rdd, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">]
			: never
		: never

type ParseAlterColumnDropAfterRd0<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? ParseAlterColumnDropNotNullChain<Rd0, Db, Sch, Tab, Tbl, Col>
		: PeekToken<Rd0> extends TokenKey<"default">
			? ParseAlterColumnDropDefaultNoop<Rd0, Db, Sch, Tab, Tbl, Col>
			: [Rd0, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">]

type ParseAlterColumnDropBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"drop">
		? SkipToken<R2> extends infer Rd0 extends TokensList
			? ParseAlterColumnDropAfterRd0<Rd0, Db, Sch, Tab, Tbl, Col>
			: never
		: never

type ParseAlterColumnAfterIdent<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"type"> | TokenIdent<"type">
		? ParseAlterColumnTypeBranch<R2, Db, Sch, Tab, Tbl, Col>
		: PeekToken<R2> extends TokenKey<"set">
			? ParseAlterColumnSetBranch<R2, Db, Sch, Tab, Tbl, Col>
			: PeekToken<R2> extends TokenKey<"drop">
				? ParseAlterColumnDropBranch<R2, Db, Sch, Tab, Tbl, Col>
				: [R2, Db, SqlParserError<"Expected TYPE, SET, or DROP after ALTER COLUMN">]

type ParseAlterColumnAfterAlterKw<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	PeekToken<Tokens> extends TokenKey<"alter">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
				? PeekToken<R1> extends infer Tcol
					? SkipToken<R1> extends infer R2 extends TokensList
						? Tcol extends TokenIdent<infer Col extends string>
							? ParseAlterColumnAfterIdent<R2, Db, Sch, Tab, Tbl, Col>
							: [R2, Db, SqlParserError<"Expected column name after ALTER COLUMN">]
						: never
					: never
				: never
			: never
		: never

type ParseAlterOneAction<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	JsqlGetTable<JsqlGetSchema<Db, Sch>, Tab> extends infer Tbl extends JsqlTableShape<"table">
		? PeekToken<Tokens> extends TokenKey<"add">
			? ParseAlterAddColumn<Tokens, Db, Sch, Tab, Tbl>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseAlterDropColumn<Tokens, Db, Sch, Tab, Tbl>
				: PeekToken<Tokens> extends TokenKey<"rename">
					? ParseAlterRenameColumn<Tokens, Db, Sch, Tab, Tbl>
					: PeekToken<Tokens> extends TokenKey<"alter">
						? ParseAlterColumnAfterAlterKw<Tokens, Db, Sch, Tab, Tbl>
						: [Tokens, Db, SqlParserError<"Unsupported ALTER TABLE action">]
		: JsqlGetSet<JsqlGetSchema<Db, Sch>, Tab> extends null
			? [Tokens, Db, SqlParserError<"Table key mismatch in ALTER TABLE">]
			: [Tokens, Db, SqlParserError<"ALTER TABLE applies only to base tables">]

type ParseAlterAfterQualified<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? JsqlGetSchema<Db, Sch> extends infer Schema extends JsqlSchemaShape
		? JsqlGetTable<Schema, Tab> extends object
			? Sch extends keyof Db["schemas"]
				? ParseAlterActions<R, Db, Sch & string, Tab & string>
				: never
			: [R, Db, SqlParserError<"Table does not exist">]
		: [R, Db, SqlParserError<"Unknown schema for ALTER TABLE">]
	: [R, Db, Err extends SqlParserError<string> ? Err : SqlParserError<"Invalid ALTER TABLE name">]

type ParseAlterAfterTableKeyword<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ParseQualifiedAlterTableName<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? ParseAlterAfterQualified<R, Db, E, Sch, Tab>
		: never

/**
 * `ALTER TABLE` for base tables: `ADD COLUMN`, `DROP COLUMN`, `RENAME COLUMN`, `ALTER COLUMN … TYPE`,
 * `SET NOT NULL` / `DROP NOT NULL`. `SET DEFAULT` / `DROP DEFAULT`, `ADD CONSTRAINT`, etc. are no-ops
 * (skipped until the next `,` or `;`).
 */
export type ParseAlterTable<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterAfterTableKeyword<SkipToken<Tokens>, Db>
		: [Tokens, Db, SqlParserError<"Expected TABLE after ALTER">]
