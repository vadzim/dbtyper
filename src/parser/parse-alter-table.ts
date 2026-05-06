import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape, JsqlColumnFactsEntry } from "../core/jsql-shapes.ts"
import type { I } from "../core/type-utils.ts"
import type {
	JsqlDbGetSchema,
	JsqlDbGetTable,
	JsqlDbGetData,
	JsqlDbReplaceData,
	JsqlSchemaGetData,
	JsqlSchemaGetTable,
	JsqlTableReplaceColumnType,
	JsqlTableReplaceColumnNullability,
	JsqlTableReplaceColumn,
	JsqlCreateColumn,
	JsqlTableGetColumn,
	JsqlDataGetColumnType,
} from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { CollectSqlTypeWords, TypeWordsToString } from "./parse-sql-type-words.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

type SkipUntilCommaOrSemi<Tokens extends TokensList> = SkipBracketedUntil<
	Tokens,
	TokenKey<","> | TokenKey<";"> | TokenEot
>

type ParseAlterAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? SkipToken<AfterFirst> extends infer Rd1 extends TokensList
			? PeekToken<Rd1> extends TokenIdent<infer B extends string>
				? [SkipToken<Rd1>, null, A, B]
				: [SkipToken<Rd1>, SqlParserError<"Expected table name after `.` in ALTER TABLE">, never, never]
			: never
		: [AfterFirst, null, Db["defaultSchema"], A]

type ParseQualifiedAlterTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: [SkipToken<Tokens>, SqlParserError<"Expected table name in ALTER TABLE">, never, never]

type ParseAlterOptionalNullSuffix<Tokens extends TokensList, Joined extends string> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"null">
				? [SkipToken<R1>, Joined]
				: [R1, Joined]
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, Joined]
			: [Tokens, Joined]

type ParseAlterAddColumnAfterColName<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
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
					? JsqlDataGetColumnType<Tbl, Col> extends null
						? ParseAlterActions<
								R3,
								JsqlDbReplaceData<Db, Sch, Tab, JsqlTableReplaceColumn<Tbl, Col, JsqlCreateColumn<J2>>>,
								Sch,
								Tab
							>
						: [R3, Db, SqlParserError<"Column already exists">]
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type FinishAlterStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: [SkipToken<Tokens>, Db, SqlParserError<"Expected `;` after ALTER TABLE">]

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
	Tbl extends JsqlDataShape<"table">,
> =
	PeekToken<Tokens> extends TokenKey<"add">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends
					| TokenKey<"constraint">
					| TokenKey<"primary">
					| TokenKey<"unique">
					| TokenKey<"foreign">
				? SkipUntilCommaOrSemi<R0> extends [infer Rskip extends TokensList, unknown]
					? ParseAlterActions<Rskip, Db, Sch, Tab>
					: never
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
					? PeekToken<R1> extends TokenIdent<infer Col extends string>
						? ParseAlterAddColumnAfterColName<SkipToken<R1>, Db, Sch, Tab, Tbl, Col>
						: [SkipToken<R1>, Db, SqlParserError<"Expected column name after ADD in ALTER TABLE">]
					: never
			: never
		: never

type ParseOptionalColumnKeyword<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"column"> ? [SkipToken<Tokens>, null] : [Tokens, null]

type ParseAlterDropColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
> =
	PeekToken<Tokens> extends TokenKey<"drop">
		? ParseOptionalColumnKeyword<SkipToken<Tokens>> extends [infer R1 extends TokensList, null]
			? PeekToken<R1> extends infer Tcol
				? Tcol extends TokenIdent<infer Col extends string>
					? JsqlDataGetColumnType<Tbl, Col> extends null
						? [SkipToken<R1>, Db, SqlParserError<"Column does not exist">]
						: JsqlTableReplaceColumn<Tbl, Col, null> extends infer U extends JsqlDataShape<"table">
							? ParseAlterActions<SkipToken<R1>, JsqlDbReplaceData<Db, Sch, Tab, U>, Sch, Tab>
							: [SkipToken<R1>, Db, SqlParserError<"Column drop failed">]
					: [SkipToken<R1>, Db, SqlParserError<"Expected column name after DROP COLUMN">]
				: never
			: never
		: never

type ParseAlterRenameAfterToKw<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
	Old extends string,
> =
	PeekToken<R2> extends TokenKey<"to">
		? SkipToken<R2> extends infer R3 extends TokensList
			? PeekToken<R3> extends TokenIdent<infer New extends string>
				? JsqlDataGetColumnType<Tbl, Old> extends null
					? [SkipToken<R3>, Db, SqlParserError<"Column does not exist">]
					: JsqlDataGetColumnType<Tbl, New> extends null
						? JsqlTableReplaceColumn<
								JsqlTableReplaceColumn<Tbl, Old, null>,
								New,
								JsqlTableGetColumn<Tbl, Old>
							> extends infer U extends JsqlDataShape<"table">
							? ParseAlterActions<SkipToken<R3>, JsqlDbReplaceData<Db, Sch, Tab, U>, Sch, Tab>
							: [SkipToken<R3>, Db, SqlParserError<"Column rename failed">]
						: [SkipToken<R3>, Db, SqlParserError<"Column already exists">]
				: [SkipToken<R3>, Db, SqlParserError<"Expected new column name after TO in RENAME COLUMN">]
			: never
		: [SkipToken<R2>, Db, SqlParserError<"Expected TO in RENAME COLUMN">]

type ParseAlterRenameAfterOldIdent<
	R2 extends TokensList,
	Told,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
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
	Tbl extends JsqlDataShape<"table">,
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
	Tbl extends JsqlDataShape<"table">,
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
					? JsqlTableReplaceColumnType<Tbl, Col, J2> extends infer U extends JsqlDataShape<"table">
						? ParseAlterActions<R4, JsqlDbReplaceData<Db, Sch, Tab, U>, Sch, Tab>
						: [R4, Db, SqlParserError<"Column does not exist">]
					: never
			: [AfterType, Db, SqlParserError<"Invalid column type in ALTER TABLE">]
		: never

type ParseAlterColumnTypeBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
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
	Tbl extends JsqlDataShape<"table">,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"set">
		? SkipToken<R2> extends infer Rs extends TokensList
			? PeekToken<Rs> extends TokenKey<"not">
				? SkipToken<Rs> extends infer Rn extends TokensList
					? PeekToken<Rn> extends infer TkNull
						? SkipToken<Rn> extends infer Rnn extends TokensList
							? TkNull extends TokenKey<"null">
								? JsqlTableReplaceColumnNullability<Tbl, Col, "not_null"> extends infer U extends
										JsqlDataShape<"table">
									? ParseAlterActions<Rnn, JsqlDbReplaceData<Db, Sch, Tab, U>, Sch, Tab>
									: [Rnn, Db, SqlParserError<"Column does not exist">]
								: [Rnn, Db, SqlParserError<"Expected NULL after SET NOT">]
							: never
						: never
					: never
				: PeekToken<Rs> extends TokenKey<"default">
					? SkipToken<Rs> extends infer Rd extends TokensList
						? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends TokensList, unknown]
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
	Tbl extends JsqlDataShape<"table">,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? SkipToken<Rd0> extends infer Rd1 extends TokensList
			? PeekToken<Rd1> extends infer Tk2
				? Tk2 extends TokenKey<"null">
					? JsqlTableReplaceColumnNullability<Tbl, Col, "nullable"> extends infer U extends
							JsqlDataShape<"table">
						? ParseAlterActions<SkipToken<Rd1>, JsqlDbReplaceData<Db, Sch, Tab, U>, Sch, Tab>
						: [SkipToken<Rd1>, Db, SqlParserError<"Column does not exist">]
					: [SkipToken<Rd1>, Db, SqlParserError<"Expected NULL after DROP NOT">]
				: never
			: never
		: never

type ParseAlterColumnDropDefaultNoop<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Rd0> extends infer Tdd
		? SkipToken<Rd0> extends infer Rdd extends TokensList
			? Tdd extends TokenKey<"default">
				? SkipUntilCommaOrSemi<Rdd> extends [infer Rsdd extends TokensList, unknown]
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
	Tbl extends JsqlDataShape<"table">,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? ParseAlterColumnDropNotNullChain<Rd0, Db, Sch, Tab, Tbl, Col>
		: PeekToken<Rd0> extends TokenKey<"default">
			? ParseAlterColumnDropDefaultNoop<Rd0, Db, Sch, Tab>
			: [Rd0, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">]

type ParseAlterColumnDropBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape<"table">,
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
	Tbl extends JsqlDataShape<"table">,
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
	Tbl extends JsqlDataShape<"table">,
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
	JsqlDbGetTable<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape<"table">
		? PeekToken<Tokens> extends TokenKey<"add">
			? ParseAlterAddColumn<Tokens, Db, Sch, Tab, Tbl>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseAlterDropColumn<Tokens, Db, Sch, Tab, Tbl>
				: PeekToken<Tokens> extends TokenKey<"rename">
					? ParseAlterRenameColumn<Tokens, Db, Sch, Tab, Tbl>
					: PeekToken<Tokens> extends TokenKey<"alter">
						? ParseAlterColumnAfterAlterKw<Tokens, Db, Sch, Tab, Tbl>
						: [Tokens, Db, SqlParserError<"Unsupported ALTER TABLE action">]
		: JsqlDbGetData<Db, Sch, Tab> extends null
			? [Tokens, Db, SqlParserError<"Table key mismatch in ALTER TABLE">]
			: [Tokens, Db, SqlParserError<"ALTER TABLE applies only to base tables">]

type ParseAlterAfterQualified<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? JsqlDbGetSchema<Db, Sch> extends infer Schema extends JsqlSchemaShape
		? JsqlSchemaGetTable<Schema, Tab> extends object
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
