import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type {
	JsqlDbReplaceColumnType,
	JsqlDbReplaceColumnNullability,
	JsqlDbReplaceColumnDefault,
	JsqlDbGetColumnType,
} from "../core/jsql-utils.ts"
import type { ParseDefaultValue } from "./parse-column-default.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type {
	ParseAlterActions,
	ParseAlterAfterOptionalColumnKw,
	ParseAlterSkipAction,
	SkipUntilCommaOrSemi,
} from "./parse-alter-table.ts"

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
		? TypeShape extends DbtyperErrorShape
			? [AfterType, Db, TypeShape]
			: TypeShape extends SqlTypeShape
				? ParseAlterColumnUsing<AfterType, JsqlDbReplaceColumnType<Db, Sch, Tab, Col, TypeShape>, Sch, Tab>
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
			? AlterColumnFormError<TokenKey<"set">, Db, PeekToken<Rs>> extends infer FormErr extends DbtyperErrorShape
				? SkipFailedStatement<Rs, Db, FormErr>
				: PeekToken<Rs> extends TokenKey<"not">
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
									: SkipFailedStatement<
											Rnn,
											Db,
											FormatError<Errors["EXPECTED_NULL_AFTER_SET_NOT"], []>
										>
								: never
							: never
						: never
					: PeekToken<Rs> extends TokenKey<"default">
						? // CORE-16: the value must fit the column, as in CREATE TABLE
							ParseDefaultValue<
								SkipToken<Rs>,
								Db,
								JsqlDbGetColumnType<Db, Sch, Tab, Col> & SqlTypeShape,
								Col
							> extends [infer Rsd extends ParserMonad, infer DefErr]
							? DefErr extends DbtyperErrorShape
								? SkipFailedStatement<Rsd, Db, DefErr>
								: ParseAlterActions<Rsd, JsqlDbReplaceColumnDefault<Db, Sch, Tab, Col, true>, Sch, Tab>
							: never
						: PeekToken<Rs> extends TokenKey<"data"> | TokenIdent<"data">
							? // `SET DATA TYPE t`: the same as `TYPE t`
								SkipToken<Rs> extends infer Rt extends ParserMonad
								? ParseAlterColumnTypeBranch<Rt, Db, Sch, Tab, Col>
								: never
							: SkipFailedStatement<
									Rs,
									Db,
									FormatError<Errors["UNSUPPORTED_ALTER_COLUMN_SET_CLAUSE"], []>
								>
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
	AlterColumnFormError<TokenKey<"drop">, Db, PeekToken<Rd0>> extends infer FormErr extends DbtyperErrorShape
		? SkipFailedStatement<Rd0, Db, FormErr>
		: PeekToken<Rd0> extends TokenKey<"not">
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

/**
 * #195: the other-dialect error for an `ALTER [COLUMN] c <action>` the chain's dialect lacks (fact `alterColumn` of
 * src/core/dialect.ts: SQLite has only `SET NOT NULL` and `DROP NOT NULL`, since 3.53), else `null`. `Action` is the
 * action's first token (`SET` / `DROP`), `Next` the one after it (`NOT`; `never` while it is not read yet).
 */
type AlterColumnFormError<Action, Db extends JsqlDatabaseShape, Next = TokenKey<"not">> =
	DialectFact<Db, "alterColumn"> extends "full"
		? null
		: [Action, Next] extends [TokenKey<"set" | "drop">, TokenKey<"not">]
			? null
			: DbDialectOnlyError<Db, "pg-alter-column">

export type ParseAlterColumnAfterAlterKw<
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
						? AsIdent<Tcol> extends TokenIdent<infer Col extends string>
							? AlterColumnFormError<PeekToken<R2>, Db> extends infer FormErr extends DbtyperErrorShape
								? SkipFailedStatement<R2, Db, FormErr>
								: JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
									? // SCHEMA-23, #154: a missing column is an error (it used to drop the table from the schema)
										SkipFailedStatement<R2, Db, FormatError<Errors["COLUMN_DOES_NOT_EXIST"], [Col]>>
									: ParseAlterColumnAfterIdent<R2, Db, Sch, Tab, Col>
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
