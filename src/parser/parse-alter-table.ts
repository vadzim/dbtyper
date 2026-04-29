import type { JsqlDatabaseShape, JsqlTableShape, JsqlColumnFactsEntry } from "../../core/jsql-shapes.ts"
import type { MergeDbPreserveScalars } from "../../core/sql-scalar-types.ts"
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
import type { CollectSqlTypeWords, SqlJoinedToTs, TypeWordsToString } from "./parse-sql-type-words.ts"

/** True when `Tab` is a key of `sets` (including under `JsqlSchemaShape & { sets: { … } }` intersections). */
type HasConcreteSet<Sets extends object, Tab extends string> = Tab extends keyof Sets ? true : false

/** `sets[Tab]` can widen with `& { [K: string]: JsqlTableShape }`; narrow to a concrete base table (not `Extract<…, { kind: "table" }>`, which degrades on index signatures). */
type AlterTableShapeAt<Sets extends object, Tab extends string> = Tab extends keyof Sets
	? Sets[Tab] extends JsqlTableShape
		? Sets[Tab]["kind"] extends "table"
			? Sets[Tab]
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
		? ReadToken<AfterFirst> extends [infer Rd1 extends TokensList, TokenKey<".">]
			? ReadToken<Rd1> extends [infer R2 extends TokensList, infer T2]
				? T2 extends TokenIdent<infer B extends string>
					? [R2, null, A, B]
					: [R2, SqlParserError<"Expected table name after `.` in ALTER TABLE">, never, never]
				: never
			: never
		: [AfterFirst, null, Db["defaultSchema"], A]

type ParseQualifiedAlterTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterFirst extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer A extends string>
			? ParseAlterAfterFirstIdent<AfterFirst, Db, A>
			: [AfterFirst, SqlParserError<"Expected table name in ALTER TABLE">, never, never]
		: never

type ReplaceTableInDb<
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	NewShape extends JsqlTableShape,
> = MergeDbPreserveScalars<
	Db,
	{
		defaultSchema: Db["defaultSchema"]
		schemas: {
			[K in keyof Db["schemas"]]: K extends Sch
				? { sets: Omit<Db["schemas"][K]["sets"], Tab> & Record<Tab, NewShape> } & Omit<Db["schemas"][K], "sets">
				: Db["schemas"][K]
		}
	}
>

type ApplyAddColumn<
	T extends JsqlTableShape,
	Col extends string,
	Ts,
	Sql extends string,
> = Col extends keyof T["columns"]
	? SqlParserError<"Column already exists">
	: {
			kind: T["kind"]
			columns: MergeRecords<T["columns"], Record<Col, Ts>>
			column_sql_types: T["column_sql_types"] extends infer S
				? S extends Record<string, string>
					? MergeStringRecords<S, Record<Col, Sql>>
					: Record<Col, Sql>
				: Record<Col, Sql>
			constraints?: T["constraints"]
			column_facts?: T["column_facts"]
		} & JsqlTableShape

type ApplyDropColumn<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? {
			kind: T["kind"]
			columns: Omit<T["columns"], Col>
			column_sql_types: T["column_sql_types"] extends infer S
				? S extends Record<string, string>
					? Omit<S, Col>
					: S
				: undefined
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
				column_sql_types: T["column_sql_types"] extends infer S
					? S extends Record<string, string>
						? Old extends keyof S
							? MergeStringRecords<Omit<S, Old>, Record<New, S[Old]>>
							: Record<New, string>
						: Record<New, string>
					: Record<New, string>
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
	Ts,
	Sql extends string,
> = Col extends keyof T["columns"]
	? {
			kind: T["kind"]
			columns: MergeRecords<T["columns"], Record<Col, Ts>>
			column_sql_types: T["column_sql_types"] extends infer S
				? S extends Record<string, string>
					? MergeStringRecords<S, Record<Col, Sql>>
					: Record<Col, Sql>
				: Record<Col, Sql>
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
			? MergeRecords<F, Record<Col, F[Col] & Patch>>
			: MergeRecords<F, Record<Col, Patch>>
		: Record<Col, Patch>
	: Record<Col, Patch>

type ApplySetNotNull<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? Omit<T, "column_facts"> & { column_facts: MergeColFactPatch<T, Col, { not_null: true }> } & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ApplyDropNotNull<T extends JsqlTableShape, Col extends string> = Col extends keyof T["columns"]
	? T["column_facts"] extends infer F
		? F extends Record<string, JsqlColumnFactsEntry>
			? Col extends keyof F
				? Omit<T, "column_facts"> & {
						column_facts: MergeRecords<F, Record<Col, Omit<F[Col], "not_null"> & { nullable: true }>>
					} & JsqlTableShape
				: Omit<T, "column_facts"> & {
						column_facts: MergeRecords<F, Record<Col, { nullable: true }>>
					} & JsqlTableShape
			: Omit<T, "column_facts"> & { column_facts: Record<Col, { nullable: true }> } & JsqlTableShape
		: Omit<T, "column_facts"> & { column_facts: Record<Col, { nullable: true }> } & JsqlTableShape
	: SqlParserError<"Column does not exist">

type ParseAlterOptionalNullSuffix<Tokens extends TokensList, Ts, Joined extends string> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"not">]
			? PeekToken<R1> extends TokenKey<"null">
				? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<"null">]
					? [R2, Ts, Joined]
					: never
				: [R1, Ts, Joined]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"null">]
				? [Rn, Ts, Joined]
				: never
			: [Tokens, Ts, Joined]

type ParseAlterAddColumnAfterColName<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	CollectSqlTypeWords<R2> extends [infer AfterType extends TokensList, infer Words extends readonly string[]]
		? TypeWordsToString<Words> extends infer Joined extends string
			? Joined extends ""
				? [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
				: SqlJoinedToTs<Joined, Db["scalarTypes"]> extends infer Ts
					? ParseAlterOptionalNullSuffix<AfterType, Ts, Joined> extends [
							infer R3 extends TokensList,
							infer Ts2,
							infer J2 extends string,
						]
						? ApplyAddColumn<Tbl, Col, Ts2, J2> extends infer U
							? U extends SqlParserError<string>
								? [R3, Db, U]
								: U extends JsqlTableShape
									? ParseAlterActions<R3, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
									: never
							: never
						: never
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type FinishAlterStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? [R1, Db, null]
			: [R1, Db, SqlParserError<"Expected `;` after ALTER TABLE">]
		: never

type ParseAlterActions<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? FinishAlterStatement<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<",">
			? ParseAlterActions<SkipToken<Tokens>, Db, Sch, Tab>
			: ParseAlterOneAction<Tokens, Db, Sch, Tab>

type ParseAlterAfterOptionalColumnKw<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"column">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"column">]
			? [R1, null]
			: never
		: [Tokens, null]

type ParseAlterAddColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"add">]
		? PeekToken<R0> extends TokenKey<"constraint"> | TokenKey<"primary"> | TokenKey<"unique"> | TokenKey<"foreign">
			? SkipUntilCommaOrSemi<R0> extends [infer Rskip extends TokensList, null]
				? ParseAlterActions<Rskip, Db, Sch, Tab>
				: never
			: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
				? ReadToken<R1> extends [infer R2 extends TokensList, infer Tcol]
					? Tcol extends TokenIdent<infer Col extends string>
						? ParseAlterAddColumnAfterColName<R2, Db, Sch, Tab, Tbl, Col>
						: [R2, Db, SqlParserError<"Expected column name after ADD in ALTER TABLE">]
					: never
				: never
		: never

type ParseAlterDropColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"drop">]
		? PeekToken<R0> extends TokenKey<"column">
			? ReadToken<R0> extends [infer R1 extends TokensList, TokenKey<"column">]
				? ReadToken<R1> extends [infer R2 extends TokensList, infer Tcol]
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
			: ReadToken<R0> extends [infer R1b extends TokensList, TokenIdent<infer Col2 extends string>]
				? ApplyDropColumn<Tbl, Col2> extends infer U2
					? U2 extends SqlParserError<string>
						? [R1b, Db, U2]
						: U2 extends JsqlTableShape
							? ParseAlterActions<R1b, ReplaceTableInDb<Db, Sch, Tab, U2>, Sch, Tab>
							: never
					: never
				: never
		: never

type ParseAlterRenameAfterToKw<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Old extends string,
> =
	ReadToken<R2> extends [infer R3 extends TokensList, infer Tto]
		? Tto extends TokenKey<"to">
			? ReadToken<R3> extends [infer R4 extends TokensList, infer Tnew]
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
			: [R3, Db, SqlParserError<"Expected TO in RENAME COLUMN">]
		: never

type ParseAlterRenameAfterOldIdent<
	R2 extends TokensList,
	Told,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
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
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"rename">]
		? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
			? ReadToken<R1> extends [infer R2 extends TokensList, infer Told]
				? ParseAlterRenameAfterOldIdent<R2, Told, Db, Sch, Tab, Tbl>
				: never
			: never
		: never

type ParseAlterColumnTypeAfterTypeKw<
	R3 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	CollectSqlTypeWords<R3> extends [infer AfterType extends TokensList, infer Words extends readonly string[]]
		? TypeWordsToString<Words> extends infer Joined extends string
			? Joined extends ""
				? [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
				: SqlJoinedToTs<Joined, Db["scalarTypes"]> extends infer Ts
					? ParseAlterOptionalNullSuffix<AfterType, Ts, Joined> extends [
							infer R4 extends TokensList,
							infer Ts2,
							infer J2 extends string,
						]
						? ApplyAlterColumnType<Tbl, Col, Ts2, J2> extends infer U
							? U extends SqlParserError<string>
								? [R4, Db, U]
								: U extends JsqlTableShape
									? ParseAlterActions<R4, ReplaceTableInDb<Db, Sch, Tab, U>, Sch, Tab>
									: never
							: never
						: never
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type ParseAlterColumnTypeBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	ReadToken<R2> extends [infer R3 extends TokensList, infer Tkw]
		? Tkw extends TokenKey<"type"> | TokenIdent<"type">
			? ParseAlterColumnTypeAfterTypeKw<R3, Db, Sch, Tab, Tbl, Col>
			: never
		: never

type ParseAlterColumnSetBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	ReadToken<R2> extends [infer Rs extends TokensList, TokenKey<"set">]
		? PeekToken<Rs> extends TokenKey<"not">
			? ReadToken<Rs> extends [infer Rn extends TokensList, TokenKey<"not">]
				? ReadToken<Rn> extends [infer Rnn extends TokensList, infer TkNull]
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
			: PeekToken<Rs> extends TokenKey<"default">
				? ReadToken<Rs> extends [infer Rd extends TokensList, TokenKey<"default">]
					? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends TokensList, null]
						? ParseAlterActions<Rsd, Db, Sch, Tab>
						: never
					: never
				: [Rs, Db, SqlParserError<"Unsupported ALTER COLUMN SET clause">]
		: never

type ParseAlterColumnDropNotNullChain<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	ReadToken<Rd0> extends [infer Rd1 extends TokensList, TokenKey<"not">]
		? ReadToken<Rd1> extends [infer Rd2 extends TokensList, infer Tk2]
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

type ParseAlterColumnDropDefaultNoop<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	ReadToken<Rd0> extends [infer Rdd extends TokensList, infer Tdd]
		? Tdd extends TokenKey<"default">
			? SkipUntilCommaOrSemi<Rdd> extends [infer Rsdd extends TokensList, null]
				? ParseAlterActions<Rsdd, Db, Sch, Tab>
				: never
			: [Rdd, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">]
		: never

type ParseAlterColumnDropAfterRd0<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
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
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Col extends string,
> =
	ReadToken<R2> extends [infer Rd0 extends TokensList, TokenKey<"drop">]
		? ParseAlterColumnDropAfterRd0<Rd0, Db, Sch, Tab, Tbl, Col>
		: never

type ParseAlterColumnAfterIdent<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
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
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Tbl extends JsqlTableShape,
> =
	ReadToken<Tokens> extends [infer R0 extends TokensList, TokenKey<"alter">]
		? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
			? ReadToken<R1> extends [infer R2 extends TokensList, infer Tcol]
				? Tcol extends TokenIdent<infer Col extends string>
					? ParseAlterColumnAfterIdent<R2, Db, Sch, Tab, Tbl, Col>
					: [R2, Db, SqlParserError<"Expected column name after ALTER COLUMN">]
				: never
			: never
		: never

type ParseAlterOneAction<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
> = Db["schemas"][Sch]["sets"] extends object
	? Tab extends keyof Db["schemas"][Sch]["sets"]
		? AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab> extends never
			? [Tokens, Db, SqlParserError<"ALTER TABLE applies only to base tables">]
			: PeekToken<Tokens> extends TokenKey<"add">
				? ParseAlterAddColumn<Tokens, Db, Sch, Tab, AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab>>
				: PeekToken<Tokens> extends TokenKey<"drop">
					? ParseAlterDropColumn<Tokens, Db, Sch, Tab, AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab>>
					: PeekToken<Tokens> extends TokenKey<"rename">
						? ParseAlterRenameColumn<
								Tokens,
								Db,
								Sch,
								Tab,
								AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab>
							>
						: PeekToken<Tokens> extends TokenKey<"alter">
							? ParseAlterColumnAfterAlterKw<
									Tokens,
									Db,
									Sch,
									Tab,
									AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab>
								>
							: [Tokens, Db, SqlParserError<"Unsupported ALTER TABLE action">]
		: [Tokens, Db, SqlParserError<"Table key mismatch in ALTER TABLE">]
	: never

type ParseAlterAfterQualified<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? Sch extends keyof Db["schemas"]
		? HasConcreteSet<Db["schemas"][Sch]["sets"], Tab> extends true
			? AlterTableShapeAt<Db["schemas"][Sch]["sets"], Tab> extends never
				? [R, Db, SqlParserError<"ALTER TABLE applies only to base tables">]
				: ParseAlterActions<R, Db, Sch & keyof Db["schemas"] & string, Tab & string>
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
