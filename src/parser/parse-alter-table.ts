import type { JsqlDatabaseShape, JsqlDataShape, JsqlColumnFactsEntry } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetTable,
	JsqlDbGetData,
	JsqlDbReplaceColumn,
	JsqlDbReplaceColumnType,
	JsqlDbReplaceColumnNullability,
	JsqlDbGetColumn,
	JsqlDbGetColumnType,
} from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

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

type ParseAlterAddColumnAfterColName<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	ParseSqlType<R2> extends [infer AfterType extends TokensList, infer TypeShape]
		? TypeShape extends SqlTypeShape
			? TypeShape extends SqlParserError<string>
				? [AfterType, Db, TypeShape]
				: JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
					? ParseAlterActions<AfterType, JsqlDbReplaceColumn<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
					: SkipFailedStatement<AfterType, Db, SqlParserError<"Column already exists">>
			: [AfterType, Db, SqlParserError<"Expected column type in ALTER TABLE">]
		: never

type FinishAlterStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, SqlParserError<"Expected `;` after ALTER TABLE">>

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
> =
	PeekToken<Tokens> extends TokenKey<"add">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? PeekToken<R0> extends
					| TokenKey<"constraint">
					| TokenKey<"primary">
					| TokenKey<"unique">
					| TokenKey<"foreign">
				? SkipUntilCommaOrSemi<R0> extends [infer Rskip extends TokensList, unknown]
					? ParseAlterActions<SkipToken<Rskip>, Db, Sch, Tab>
					: never
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
					? PeekToken<R1> extends TokenIdent<infer Col extends string>
						? ParseAlterAddColumnAfterColName<SkipToken<R1>, Db, Sch, Tab, Col>
						: SkipFailedExpression<
									R1,
									SqlParserError<"Expected column name after ADD in ALTER TABLE">
							  > extends [infer Rest extends TokensList, infer Err]
							? [Rest, Db, Err]
							: never
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
> =
	PeekToken<Tokens> extends TokenKey<"drop">
		? ParseOptionalColumnKeyword<SkipToken<Tokens>> extends [infer R1 extends TokensList, null]
			? PeekToken<R1> extends TokenIdent<infer Col extends string>
				? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
					? [R1, Db, SqlParserError<"Column does not exist">]
					: ParseAlterActions<SkipToken<R1>, JsqlDbReplaceColumn<Db, Sch, Tab, Col, null>, Sch, Tab>
				: SkipFailedStatement<R1, Db, SqlParserError<"Expected column name after DROP COLUMN">>
			: never
		: never

type ParseAlterRenameAfterToKw<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Old extends string,
> =
	PeekToken<R2> extends TokenKey<"to">
		? SkipToken<R2> extends infer R3 extends TokensList
			? PeekToken<R3> extends TokenIdent<infer New extends string>
				? JsqlDbGetColumnType<Db, Sch, Tab, Old> extends null
					? [R3, Db, SqlParserError<"Column does not exist">]
					: JsqlDbGetColumnType<Db, Sch, Tab, New> extends null
						? JsqlDbGetColumn<Db, Sch, Tab, Old> extends infer OldCol extends
								| (JsqlColumnFactsEntry & { type: SqlTypeShape })
								| null
							? JsqlDbReplaceColumn<
									JsqlDbReplaceColumn<Db, Sch, Tab, Old, null>,
									Sch,
									Tab,
									New,
									OldCol
								> extends infer NewDb extends JsqlDatabaseShape
								? ParseAlterActions<SkipToken<R3>, NewDb, Sch, Tab>
								: SkipFailedStatement<R3, Db, SqlParserError<"Column rename failed">>
							: never
						: SkipFailedStatement<R3, Db, SqlParserError<"Column already exists">>
				: SkipFailedExpression<
							R3,
							SqlParserError<"Expected new column name after TO in RENAME COLUMN">
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: SkipFailedStatement<R2, Db, SqlParserError<"Expected TO in RENAME COLUMN">>

type ParseAlterRenameAfterOldName<
	R2 extends TokensList,
	Told,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	Told extends TokenIdent<infer Old extends string>
		? PeekToken<R2> extends TokenKey<"to">
			? ParseAlterRenameAfterToKw<R2, Db, Sch, Tab, Old>
			: SkipFailedStatement<R2, Db, SqlParserError<"Expected TO in RENAME COLUMN">>
		: SkipFailedStatement<R2, Db, SqlParserError<"Expected old column name in RENAME COLUMN">>

type ParseAlterRenameColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"rename">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
				? PeekToken<R1> extends infer Told
					? SkipToken<R1> extends infer R2 extends TokensList
						? ParseAlterRenameAfterOldName<R2, Told, Db, Sch, Tab>
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
	Col extends string,
> =
	ParseSqlType<R3> extends [infer AfterType extends TokensList, infer TypeShape]
		? TypeShape extends SqlTypeShape
			? TypeShape extends SqlParserError<string>
				? [AfterType, Db, TypeShape]
				: ParseAlterActions<AfterType, JsqlDbReplaceColumnType<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
			: [AfterType, Db, SqlParserError<"Expected column type in ALTER TABLE">]
		: never

type ParseAlterColumnTypeBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends infer Tkw
		? SkipToken<R2> extends infer R3 extends TokensList
			? Tkw extends TokenKey<"type"> | TokenIdent<"type">
				? ParseAlterColumnTypeAfterTypeKw<R3, Db, Sch, Tab, Col>
				: never
			: never
		: never

type ParseAlterColumnSetBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"set">
		? SkipToken<R2> extends infer Rs extends TokensList
			? PeekToken<Rs> extends TokenKey<"not">
				? SkipToken<Rs> extends infer Rn extends TokensList
					? PeekToken<Rn> extends infer TkNull
						? SkipToken<Rn> extends infer Rnn extends TokensList
							? TkNull extends TokenKey<"null">
								? ParseAlterActions<
										Rnn,
										JsqlDbReplaceColumnNullability<Db, Sch, Tab, Col, "not_null">,
										Sch,
										Tab
									>
								: SkipFailedStatement<Rnn, Db, SqlParserError<"Expected NULL after SET NOT">>
							: never
						: never
					: never
				: PeekToken<Rs> extends TokenKey<"default">
					? SkipToken<Rs> extends infer Rd extends TokensList
						? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends TokensList, unknown]
							? ParseAlterActions<SkipToken<Rsd>, Db, Sch, Tab>
							: never
						: never
					: SkipFailedStatement<Rs, Db, SqlParserError<"Unsupported ALTER COLUMN SET clause">>
			: never
		: never

type ParseAlterColumnDropNotNullChain<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? SkipToken<Rd0> extends infer Rd1 extends TokensList
			? PeekToken<Rd1> extends infer Tk2
				? Tk2 extends TokenKey<"null">
					? ParseAlterActions<
							SkipToken<Rd1>,
							JsqlDbReplaceColumnNullability<Db, Sch, Tab, Col, "nullable">,
							Sch,
							Tab
						>
					: SkipFailedStatement<Rd1, Db, SqlParserError<"Expected NULL after DROP NOT">>
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
					? ParseAlterActions<SkipToken<Rsdd>, Db, Sch, Tab>
					: never
				: SkipFailedStatement<Rdd, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">>
			: never
		: never

type ParseAlterColumnDropAfterRd0<
	Rd0 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? ParseAlterColumnDropNotNullChain<Rd0, Db, Sch, Tab, Col>
		: PeekToken<Rd0> extends TokenKey<"default">
			? ParseAlterColumnDropDefaultNoop<Rd0, Db, Sch, Tab>
			: SkipFailedStatement<Rd0, Db, SqlParserError<"Unsupported ALTER COLUMN DROP clause">>

type ParseAlterColumnDropBranch<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"drop">
		? SkipToken<R2> extends infer Rd0 extends TokensList
			? ParseAlterColumnDropAfterRd0<Rd0, Db, Sch, Tab, Col>
			: never
		: never

type ParseAlterColumnAfterIdent<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"type"> | TokenIdent<"type">
		? ParseAlterColumnTypeBranch<R2, Db, Sch, Tab, Col>
		: PeekToken<R2> extends TokenKey<"set">
			? ParseAlterColumnSetBranch<R2, Db, Sch, Tab, Col>
			: PeekToken<R2> extends TokenKey<"drop">
				? ParseAlterColumnDropBranch<R2, Db, Sch, Tab, Col>
				: SkipFailedStatement<R2, Db, SqlParserError<"Expected TYPE, SET, or DROP after ALTER COLUMN">>

type ParseAlterColumnAfterAlterKw<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"alter">
		? SkipToken<Tokens> extends infer R0 extends TokensList
			? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends TokensList, null]
				? PeekToken<R1> extends infer Tcol
					? SkipToken<R1> extends infer R2 extends TokensList
						? Tcol extends TokenIdent<infer Col extends string>
							? ParseAlterColumnAfterIdent<R2, Db, Sch, Tab, Col>
							: SkipFailedExpression<
										R2,
										SqlParserError<"Expected column name after ALTER COLUMN">
								  > extends [infer Rest extends TokensList, infer Err]
								? [Rest, Db, Err]
								: never
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
	JsqlDbGetTable<Db, Sch, Tab> extends JsqlDataShape<"table">
		? PeekToken<Tokens> extends TokenKey<"add">
			? ParseAlterAddColumn<Tokens, Db, Sch, Tab>
			: PeekToken<Tokens> extends TokenKey<"drop">
				? ParseAlterDropColumn<Tokens, Db, Sch, Tab>
				: PeekToken<Tokens> extends TokenKey<"rename">
					? ParseAlterRenameColumn<Tokens, Db, Sch, Tab>
					: PeekToken<Tokens> extends TokenKey<"alter">
						? ParseAlterColumnAfterAlterKw<Tokens, Db, Sch, Tab>
						: SkipFailedStatement<Tokens, Db, SqlParserError<"Unsupported ALTER TABLE action">>
		: JsqlDbGetData<Db, Sch, Tab> extends null
			? [Tokens, Db, SqlParserError<"Table key mismatch in ALTER TABLE">]
			: SkipFailedStatement<Tokens, Db, SqlParserError<"ALTER TABLE applies only to base tables">>

type ParseAlterAfterQualified<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? JsqlDbGetTable<Db, Sch, Tab> extends object
		? Sch extends keyof Db["schemas"]
			? ParseAlterActions<R, Db, Sch & string, Tab & string>
			: never
		: SkipFailedStatement<R, Db, SqlParserError<"Table does not exist">>
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
		: SkipFailedStatement<Tokens, Db, SqlParserError<"Expected TABLE after ALTER">>
