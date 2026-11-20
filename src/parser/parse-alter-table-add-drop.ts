import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetTable,
	JsqlDbReplaceColumn,
	JsqlDbReplaceColumnNullability,
	JsqlDbGetColumnType,
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
import type { ParseOneColumnAfterColName } from "./parse-create-table-columns.ts"
import type { WithColumnSpelling } from "./parse-create-table.ts"
import type { ParseNameList } from "./parse-table-constraints.ts"
import type { ParseAlterActions, ParseAlterAfterOptionalColumnKw, ParseAlterSkipAction } from "./parse-alter-table.ts"

export type ParseAlterAddColumn<
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
									: ParseOneColumnAfterColName<
											R2,
											WithColumnSpelling<Db, Col, PeekToken<R1>>,
											Sch,
											Tab,
											readonly [],
											Col,
											true
										>
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

type ParseOptionalColumnKeyword<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"column"> ? [SkipToken<Tokens>, null] : [Tokens, null]

export type ParseAlterDropColumn<
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
