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
import type { FormatError, DbtyperError } from "../dbtyper-error.ts"
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
				: [SkipToken<Rd1>, FormatError<"EXPECTED_TABLE_NAME", ["after `.` in ALTER TABLE"]>, never, never]
			: never
		: [AfterFirst, null, Db["defaultSchema"], A]

type ParseQualifiedAlterTableName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: [SkipToken<Tokens>, FormatError<"EXPECTED_TABLE_NAME", ["in ALTER TABLE"]>, never, never]

type ParseAlterAddColumnAfterColName<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	ParseSqlType<R2> extends [infer AfterType extends TokensList, infer TypeShape]
		? TypeShape extends SqlTypeShape
			? TypeShape extends DbtyperError<any, any>
				? [AfterType, Db, TypeShape]
				: JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
					? ParseAlterActions<AfterType, JsqlDbReplaceColumn<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
					: SkipFailedStatement<AfterType, Db, FormatError<"COLUMN_ALREADY_EXISTS", [Col]>>
			: [AfterType, Db, FormatError<"EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE", []>]
		: never

type FinishAlterStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SEMICOLON", ["ALTER TABLE"]>>

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
									FormatError<"EXPECTED_COLUMN_NAME", ["after ADD in ALTER TABLE"]>
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
					? [R1, Db, FormatError<"COLUMN_DOES_NOT_EXIST", [Col]>]
					: ParseAlterActions<SkipToken<R1>, JsqlDbReplaceColumn<Db, Sch, Tab, Col, null>, Sch, Tab>
				: SkipFailedStatement<R1, Db, FormatError<"EXPECTED_COLUMN_NAME", ["after DROP COLUMN"]>>
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
					? [R3, Db, FormatError<"COLUMN_DOES_NOT_EXIST", [Old]>]
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
								: SkipFailedStatement<R3, Db, FormatError<"COLUMN_RENAME_FAILED", []>>
							: never
						: SkipFailedStatement<R3, Db, FormatError<"COLUMN_ALREADY_EXISTS", [New]>>
				: SkipFailedExpression<
							R3,
							FormatError<"EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN", []>
					  > extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_TO_IN_RENAME_COLUMN", []>>

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
			: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_TO_IN_RENAME_COLUMN", []>>
		: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN", []>>

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
			? TypeShape extends DbtyperError<any, any>
				? [AfterType, Db, TypeShape]
				: ParseAlterActions<AfterType, JsqlDbReplaceColumnType<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
			: [AfterType, Db, FormatError<"EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE", []>]
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
								: SkipFailedStatement<Rnn, Db, FormatError<"EXPECTED_NULL_AFTER_SET_NOT", []>>
							: never
						: never
					: never
				: PeekToken<Rs> extends TokenKey<"default">
					? SkipToken<Rs> extends infer Rd extends TokensList
						? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends TokensList, unknown]
							? ParseAlterActions<SkipToken<Rsd>, Db, Sch, Tab>
							: never
						: never
					: SkipFailedStatement<Rs, Db, FormatError<"UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE", []>>
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
					: SkipFailedStatement<Rd1, Db, FormatError<"EXPECTED_NULL_AFTER_DROP_NOT", []>>
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
				: SkipFailedStatement<Rdd, Db, FormatError<"UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE", []>>
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
			: SkipFailedStatement<Rd0, Db, FormatError<"UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE", []>>

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
				: SkipFailedStatement<R2, Db, FormatError<"EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN", []>>

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
										FormatError<"EXPECTED_COLUMN_NAME", ["after ALTER COLUMN"]>
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
						: SkipFailedStatement<Tokens, Db, FormatError<"UNSUPPORTED_ALTER_TABLE_ACTION", []>>
		: JsqlDbGetData<Db, Sch, Tab> extends null
			? [Tokens, Db, FormatError<"TABLE_KEY_MISMATCH_IN_ALTER_TABLE", []>]
			: SkipFailedStatement<Tokens, Db, FormatError<"ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES", []>>

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
		: SkipFailedStatement<R, Db, FormatError<"TABLE_DOES_NOT_EXIST", []>>
	: [R, Db, Err extends DbtyperError<any, any> ? Err : FormatError<"INVALID_ALTER_TABLE_NAME", []>]

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
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_TABLE_AFTER_ALTER", []>>
