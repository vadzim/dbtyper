import type { JsqlDatabaseShape, JsqlDataShape, JsqlColumnFactsEntry } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetTable,
	UnqualifiedSchema,
	JsqlDbGetData,
	JsqlDbReplaceColumn,
	JsqlDbReplaceColumnType,
	JsqlDbReplaceColumnNullability,
	JsqlDbReplaceColumnDefault,
	JsqlDbGetColumn,
	JsqlDbGetColumnType,
	JsqlDbReplaceData,
	JsqlDbAddConstraintName,
	JsqlDbDropConstraintName,
} from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseOneColumnAfterColName, ParseNameList } from "./parse-create-table.ts"

type SkipUntilCommaOrSemi<Tokens extends ParserMonad> = SkipBracketedUntil<
	Tokens,
	TokenKey<","> | TokenKey<";"> | TokenEot
>

type ParseAlterAfterFirstIdent<AfterFirst extends ParserMonad, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? SkipToken<AfterFirst> extends infer Rd1 extends ParserMonad
			? PeekToken<Rd1> extends TokenIdent<infer B extends string>
				? [SkipToken<Rd1>, null, A, B]
				: [Rd1, FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in ALTER TABLE"]>, null, null]
			: never
		: [AfterFirst, null, UnqualifiedSchema<Db, A>, A]

type ParseQualifiedAlterTableName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: [SkipToken<Tokens>, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in ALTER TABLE"]>, null, null]

export type FinishAlterStatement<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, null]
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["ALTER TABLE"]>>

export type ParseAlterActions<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? FinishAlterStatement<Tokens, Db>
		: PeekToken<Tokens> extends TokenKey<",">
			? ParseAlterActions<SkipToken<Tokens>, Db, Sch, Tab>
			: ParseAlterOneAction<Tokens, Db, Sch, Tab>

type ParseAlterAfterOptionalColumnKw<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"column"> ? [SkipToken<Tokens>, null] : [Tokens, null]

type ParseAlterAddColumn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"add">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends
					| TokenKey<"constraint">
					| TokenKey<"primary">
					| TokenKey<"unique">
					| TokenKey<"foreign">
					| TokenKey<"check">
				? ParseAlterAddConstraint<R0, Db, Sch, Tab>
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends ParserMonad, null]
					? PeekToken<R1> extends TokenIdent<infer Col extends string>
						? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
							? SkipToken<R1> extends infer R2 extends ParserMonad
								? PeekToken<R2> extends TokenKey<";" | ","> | TokenEot
									? SkipFailedStatement<
											R2,
											Db,
											FormatError<Errors["EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE"], []>
										>
									: ParseOneColumnAfterColName<R2, Db, Sch, Tab, readonly [], Col, true>
								: never
							: SkipFailedStatement<R1, Db, FormatError<Errors["COLUMN_ALREADY_EXISTS"], [Col]>>
						: SkipFailedExpression<
									R1,
									FormatError<Errors["EXPECTED_COLUMN_NAME"], ["after ADD in ALTER TABLE"]>
							  > extends [infer Rest extends ParserMonad, infer Err]
							? [Rest, Db, Err]
							: never
					: never
			: never
		: never

/**
 * `ADD [CONSTRAINT name] PRIMARY KEY | UNIQUE | FOREIGN KEY | CHECK …` (PGT-19): a primary key makes its columns
 * NOT NULL, the other constraints change no type; the rest of the action is skipped.
 */
type ParseAlterAddConstraint<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"constraint">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
				? ParseAlterConstraintBody<SkipToken<R1>, JsqlDbAddConstraintName<Db, Sch, Tab, CName>, Sch, Tab>
				: ParseAlterConstraintBody<SkipToken<R1>, Db, Sch, Tab>
			: never
		: ParseAlterConstraintBody<Tokens, Db, Sch, Tab>

type ParseAlterConstraintBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"primary">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? SkipToken<R0> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"(">
					? SkipToken<R1> extends infer R1b extends ParserMonad
						? ParseNameList<R1b, readonly []> extends [infer R2 extends ParserMonad, infer Names]
							? Names extends DbtyperErrorShape
								? [R2, Db, Names]
								: Names extends readonly string[]
									? Exclude<
											Names[number],
											keyof JsqlTableColumns<Db, Sch, Tab>
										> extends infer Missing extends string
										? [Missing] extends [never]
											? ParseAlterSkipAction<
													R2,
													AlterPrimaryKeyNotNull<Db, Sch, Tab, Names>,
													Sch,
													Tab
												>
											: SkipFailedStatement<
													R2,
													Db,
													FormatError<Errors["UNKNOWN_COLUMN"], [Missing, "PRIMARY KEY"]>
												>
										: never
									: never
							: never
						: never
					: ParseAlterSkipAction<R1, Db, Sch, Tab>
				: never
			: never
		: ParseAlterSkipAction<Tokens, Db, Sch, Tab>

type JsqlTableColumns<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> =
	JsqlDbGetTable<Db, Sch, Tab> extends { columns: infer C } ? C : {}

type AlterPrimaryKeyNotNull<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Names extends readonly string[],
> = Names extends readonly [infer N extends string, ...infer Rest extends readonly string[]]
	? AlterPrimaryKeyNotNull<JsqlDbReplaceColumnNullability<Db, Sch, Tab, N, "not_null">, Sch, Tab, Rest>
	: Db

/** The rest of an action that changes no type is skipped up to `,` or `;`. */
type ParseAlterSkipAction<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	SkipUntilCommaOrSemi<Tokens> extends [infer R extends ParserMonad, unknown]
		? ParseAlterActions<R, Db, Sch, Tab>
		: never

type ParseOptionalColumnKeyword<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"column"> ? [SkipToken<Tokens>, null] : [Tokens, null]

type ParseAlterDropColumn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"drop">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"constraint">
				? // PGT-19: dropping a constraint changes no type (a dropped primary key keeps NOT NULL: not tracked)
					SkipToken<R0> extends infer R1 extends ParserMonad
					? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
						? ParseAlterSkipAction<R1, JsqlDbDropConstraintName<Db, Sch, Tab, CName>, Sch, Tab>
						: ParseAlterSkipAction<R1, Db, Sch, Tab>
					: never
				: ParseAlterDropColumnNamed<R0, Db, Sch, Tab>
			: never
		: never

type ParseAlterDropColumnNamed<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	ParseOptionalColumnKeyword<R0> extends [infer R1 extends ParserMonad, null]
		? PeekToken<R1> extends TokenIdent<infer Col extends string>
			? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
				? [R1, Db, FormatError<Errors["COLUMN_DOES_NOT_EXIST"], [Col]>]
				: ParseAlterActions<SkipToken<R1>, JsqlDbReplaceColumn<Db, Sch, Tab, Col, null>, Sch, Tab>
			: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["after DROP COLUMN"]>>
		: never

type ParseAlterRenameAfterToKw<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Old extends string,
> =
	PeekToken<R2> extends TokenKey<"to">
		? SkipToken<R2> extends infer R3 extends ParserMonad
			? PeekToken<R3> extends TokenIdent<infer New extends string>
				? JsqlDbGetColumnType<Db, Sch, Tab, Old> extends null
					? [R3, Db, FormatError<Errors["COLUMN_DOES_NOT_EXIST"], [Old]>]
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
								: SkipFailedStatement<R3, Db, FormatError<Errors["COLUMN_RENAME_FAILED"], []>>
							: never
						: SkipFailedStatement<R3, Db, FormatError<Errors["COLUMN_ALREADY_EXISTS"], [New]>>
				: SkipFailedExpression<
							R3,
							FormatError<Errors["EXPECTED_NEW_COLUMN_NAME_AFTER_TO_IN_RENAME_COLUMN"], []>
					  > extends [infer Rest extends ParserMonad, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_TO_IN_RENAME_COLUMN"], []>>

type ParseAlterRenameAfterOldName<
	R2 extends ParserMonad,
	Told,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	Told extends TokenIdent<infer Old extends string>
		? PeekToken<R2> extends TokenKey<"to">
			? ParseAlterRenameAfterToKw<R2, Db, Sch, Tab, Old>
			: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_TO_IN_RENAME_COLUMN"], []>>
		: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_OLD_COLUMN_NAME_IN_RENAME_COLUMN"], []>>

/** `RENAME TO new_name` after TO: the table keeps its schema (SQLT-20). */
type ParseAlterRenameTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer New extends string>
		? JsqlDbGetData<Db, Sch, New> extends null
			? JsqlDbGetData<Db, Sch, Tab> extends infer Data extends JsqlDataShape
				? FinishAlterStatement<
						SkipToken<Tokens>,
						JsqlDbReplaceData<JsqlDbReplaceData<Db, Sch, Tab, null>, Sch, New, Data>
					>
				: never
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA"], []>>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_TABLE_NAME"], ["after RENAME TO"]>>

type ParseAlterRenameColumn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"rename">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"to">
				? ParseAlterRenameTable<SkipToken<R0>, Db, Sch, Tab>
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends ParserMonad, null]
					? PeekToken<R1> extends infer Told
						? ParseAlterRenameAfterOldName<SkipToken<R1>, Told, Db, Sch, Tab>
						: never
					: never
			: never
		: never

/** `ALTER COLUMN … TYPE t [USING expr]` (PGT-19): the conversion expression is not typed. */
type ParseAlterColumnUsing<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"using"> | TokenIdent<"using">
		? ParseAlterSkipAction<Tokens, Db, Sch, Tab>
		: ParseAlterActions<Tokens, Db, Sch, Tab>

type ParseAlterColumnTypeAfterTypeKw<
	R3 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	ParseSqlType<R3, Db, false, Sch> extends [infer AfterType extends ParserMonad, infer TypeShape]
		? TypeShape extends SqlTypeShape
			? TypeShape extends DbtyperErrorShape
				? [AfterType, Db, TypeShape]
				: ParseAlterColumnUsing<AfterType, JsqlDbReplaceColumnType<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
			: [AfterType, Db, FormatError<Errors["EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE"], []>]
		: never

type ParseAlterColumnTypeBranch<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends infer Tkw
		? SkipToken<R2> extends infer R3 extends ParserMonad
			? Tkw extends TokenKey<"type"> | TokenIdent<"type">
				? ParseAlterColumnTypeAfterTypeKw<R3, Db, Sch, Tab, Col>
				: never
			: never
		: never

type ParseAlterColumnSetBranch<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<R2> extends TokenKey<"set">
		? SkipToken<R2> extends infer Rs extends ParserMonad
			? PeekToken<Rs> extends TokenKey<"not">
				? SkipToken<Rs> extends infer Rn extends ParserMonad
					? PeekToken<Rn> extends infer TkNull
						? SkipToken<Rn> extends infer Rnn extends ParserMonad
							? TkNull extends TokenKey<"null">
								? ParseAlterActions<
										Rnn,
										JsqlDbReplaceColumnNullability<Db, Sch, Tab, Col, "not_null">,
										Sch,
										Tab
									>
								: SkipFailedStatement<Rnn, Db, FormatError<Errors["EXPECTED_NULL_AFTER_SET_NOT"], []>>
							: never
						: never
					: never
				: PeekToken<Rs> extends TokenKey<"default">
					? SkipToken<Rs> extends infer Rd extends ParserMonad
						? SkipUntilCommaOrSemi<Rd> extends [infer Rsd extends ParserMonad, unknown]
							? ParseAlterActions<Rsd, JsqlDbReplaceColumnDefault<Db, Sch, Tab, Col, true>, Sch, Tab>
							: never
						: never
					: PeekToken<Rs> extends TokenKey<"data"> | TokenIdent<"data">
						? // `SET DATA TYPE t`: the same as `TYPE t`
							SkipToken<Rs> extends infer Rt extends ParserMonad
							? ParseAlterColumnTypeBranch<Rt, Db, Sch, Tab, Col>
							: never
						: SkipFailedStatement<Rs, Db, FormatError<Errors["UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE"], []>>
			: never
		: never

type ParseAlterColumnDropNotNullChain<
	Rd0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? SkipToken<Rd0> extends infer Rd1 extends ParserMonad
			? PeekToken<Rd1> extends infer Tk2
				? Tk2 extends TokenKey<"null">
					? ParseAlterActions<
							SkipToken<Rd1>,
							JsqlDbReplaceColumnNullability<Db, Sch, Tab, Col, "nullable">,
							Sch,
							Tab
						>
					: SkipFailedStatement<Rd1, Db, FormatError<Errors["EXPECTED_NULL_AFTER_DROP_NOT"], []>>
				: never
			: never
		: never

type ParseAlterColumnDropDefaultNoop<
	Rd0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<Rd0> extends infer Tdd
		? SkipToken<Rd0> extends infer Rdd extends ParserMonad
			? Tdd extends TokenKey<"default">
				? SkipUntilCommaOrSemi<Rdd> extends [infer Rsdd extends ParserMonad, unknown]
					? ParseAlterActions<Rsdd, JsqlDbReplaceColumnDefault<Db, Sch, Tab, Col, null>, Sch, Tab>
					: never
				: SkipFailedStatement<Rdd, Db, FormatError<Errors["UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE"], []>>
			: never
		: never

type ParseAlterColumnDropAfterRd0<
	Rd0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	PeekToken<Rd0> extends TokenKey<"not">
		? ParseAlterColumnDropNotNullChain<Rd0, Db, Sch, Tab, Col>
		: PeekToken<Rd0> extends TokenKey<"default">
			? ParseAlterColumnDropDefaultNoop<Rd0, Db, Sch, Tab, Col>
			: PeekToken<Rd0> extends TokenIdent<"identity"> | TokenKey<"identity">
				? ParseAlterSkipAction<Rd0, Db, Sch, Tab>
				: SkipFailedStatement<Rd0, Db, FormatError<Errors["UNSUPPORTED_ALTER_COLUMN_DROP_CLAUSE"], []>>

type ParseAlterColumnDropBranch<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = PeekToken<R2> extends TokenKey<"drop"> ? ParseAlterColumnDropAfterRd0<SkipToken<R2>, Db, Sch, Tab, Col> : never

type ParseAlterColumnAfterIdent<
	R2 extends ParserMonad,
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
				: PeekToken<R2> extends TokenKey<"add">
					? // `ADD GENERATED … AS IDENTITY` (PGT-19): the column becomes NOT NULL with a default
						ParseAlterSkipAction<
							R2,
							JsqlDbReplaceColumnDefault<
								JsqlDbReplaceColumnNullability<Db, Sch, Tab, Col, "not_null">,
								Sch,
								Tab,
								Col,
								true
							>,
							Sch,
							Tab
						>
					: SkipFailedStatement<
							R2,
							Db,
							FormatError<Errors["EXPECTED_TYPE_SET_OR_DROP_AFTER_ALTER_COLUMN"], []>
						>

type ParseAlterColumnAfterAlterKw<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"alter">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends ParserMonad, null]
				? PeekToken<R1> extends infer Tcol
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? Tcol extends TokenIdent<infer Col extends string>
							? ParseAlterColumnAfterIdent<R2, Db, Sch, Tab, Col>
							: SkipFailedExpression<
										R2,
										FormatError<Errors["EXPECTED_COLUMN_NAME"], ["after ALTER COLUMN"]>
								  > extends [infer Rest extends ParserMonad, infer Err]
								? [Rest, Db, Err]
								: never
						: never
					: never
				: never
			: never
		: never

type ParseAlterOneAction<
	Tokens extends ParserMonad,
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
						: PeekToken<Tokens> extends
									| TokenIdent<"enable" | "disable" | "force" | "owner">
									| TokenKey<"no">
							? // PGT-21: row level security and ownership change no type
								ParseAlterSkipAction<Tokens, Db, Sch, Tab>
							: SkipFailedStatement<Tokens, Db, FormatError<Errors["UNSUPPORTED_ALTER_TABLE_ACTION"], []>>
		: JsqlDbGetData<Db, Sch, Tab> extends null
			? [Tokens, Db, FormatError<Errors["TABLE_KEY_MISMATCH_IN_ALTER_TABLE"], []>]
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["ALTER_TABLE_APPLIES_ONLY_TO_BASE_TABLES"], []>>

type ParseAlterAfterQualified<
	R extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Err,
	Sch extends string,
	Tab extends string,
> = Err extends null
	? JsqlDbGetTable<Db, Sch, Tab> extends object
		? Sch extends keyof Db["schemas"]
			? ParseAlterActions<R, Db, Sch & string, Tab & string>
			: never
		: SkipFailedStatement<R, Db, FormatError<Errors["TABLE_DOES_NOT_EXIST"], []>>
	: [R, Db, Err extends DbtyperErrorShape ? Err : FormatError<Errors["INVALID_ALTER_TABLE_NAME"], []>]

/** `ALTER TABLE IF EXISTS t …`: a no-op (skipped to `;`) when `t` does not exist. */
type ParseAlterIfExists<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseQualifiedAlterTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? JsqlDbGetTable<Db, Sch, Tab> extends object
				? ParseAlterAfterQualified<R, Db, E, Sch, Tab>
				: SkipBracketedUntil<R> extends [infer Rest extends ParserMonad, unknown]
					? [SkipToken<Rest>, Db, null]
					: never
			: ParseAlterAfterQualified<R, Db, E, Sch, Tab>
		: never

type ParseAlterAfterTableKeyword<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseAlterIfExists<SkipToken<A0>, Db>
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TABLE"], []>>
			: never
		: ParseAlterPlain<Tokens, Db>

type ParseAlterPlain<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseQualifiedAlterTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
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
export type ParseAlterTable<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"table">
		? ParseAlterAfterTableKeyword<SkipToken<Tokens>, Db>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_TABLE_AFTER_ALTER"], []>>
