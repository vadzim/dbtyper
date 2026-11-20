import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetData, JsqlDbRenameColumn, JsqlDbGetColumnType, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { FinishAlterStatement, ParseAlterActions, ParseAlterAfterOptionalColumnKw } from "./parse-alter-table.ts"

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
						? // #150: the column keeps its place in the declaration order
							JsqlDbRenameColumn<
								Db,
								Sch,
								Tab,
								Old,
								New,
								PeekToken<R3> extends { written: infer W extends string } ? W : never
							> extends infer NewDb extends JsqlDatabaseShape
							? ParseAlterActions<SkipToken<R3>, NewDb, Sch, Tab>
							: SkipFailedStatement<R3, Db, FormatError<Errors["COLUMN_RENAME_FAILED"], []>>
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

export type ParseAlterRenameColumn<
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
