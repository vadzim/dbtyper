import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	JsqlDbGetTable,
	JsqlDbReplaceColumn,
	JsqlDbReplaceColumnNullability,
	JsqlDbGetColumnType,
	JsqlDbAddConstraintName,
	JsqlDbAddDefaultConstraint,
	JsqlDbDropConstraintName,
	JsqlDbDropReferencingConstraints,
	JsqlDbReferencingConstraints,
	JsqlDbSetConstraintColumns,
	JsqlDbSetPrimaryKey,
	JsqlPrimaryKey,
	JsqlTableConstraintsOn,
	JsqlTablePrimaryKey,
} from "../core/jsql-utils.ts"
import type { LastOf } from "../core/type-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type { JoinColumnNames, SingleName } from "../core/jsql-constraint-names.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseOneColumnAfterColName } from "./parse-create-table-columns.ts"
import type { ColumnNameToken, MultiplePrimaryKeys, WithColumnSpelling } from "./parse-create-table.ts"
import type { ParseNameList } from "./parse-table-constraints.ts"
import type { ParenGroupNames } from "./parse-column-constraints.ts"
import type { ParseReferences } from "./parse-column-references.ts"
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
					? PeekToken<R1> extends TokenKey<"if">
						? ParseColumnIfExists<R1, Db, true> extends [infer R2 extends ParserMonad, infer IfErr]
							? IfErr extends DbtyperErrorShape
								? SkipFailedStatement<R2, Db, IfErr>
								: ParseAlterAddColumnNamed<R2, Db, Sch, Tab, true>
							: never
						: ParseAlterAddColumnNamed<R1, Db, Sch, Tab, false>
					: never
			: never
		: never

/** The column name of `ADD [COLUMN] [IF NOT EXISTS] name …`; with IF NOT EXISTS an existing column skips the action. */
type ParseAlterAddColumnNamed<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	IfNotExists extends boolean,
> =
	ColumnNameToken<PeekToken<R1>, Db> extends TokenIdent<infer Col extends string>
		? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<";" | ","> | TokenEot
					? SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_COLUMN_TYPE_IN_ALTER_TABLE"], []>>
					: ParseOneColumnAfterColName<
							R2,
							WithColumnSpelling<Db, Col, ColumnNameToken<PeekToken<R1>, Db>>,
							Sch,
							Tab,
							readonly [],
							Col,
							true
						>
				: never
			: IfNotExists extends true
				? ParseAlterSkipAction<R1, Db, Sch, Tab>
				: SkipFailedStatement<R1, Db, FormatError<Errors["COLUMN_ALREADY_EXISTS"], [Col]>>
		: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["after ADD in ALTER TABLE"]>> extends [
					infer Rest extends ParserMonad,
					infer Err,
			  ]
			? [Rest, Db, Err]
			: never

/**
 * At `IF` of `ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS` (PostgreSQL; SQLite has neither): `[rest after
 * EXISTS, null]` or `[rest, error]`.
 */
type ParseColumnIfExists<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Not extends boolean> =
	DbDialectOnlyError<Db, "pg-column-if-exists"> extends infer OnlyErr extends DbtyperErrorShape
		? [Tokens, OnlyErr]
		: SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Not extends true
				? PeekToken<R1> extends TokenKey<"not">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"exists">
							? [SkipToken<R2>, null]
							: [R2, FormatError<Errors["EXPECTED_NOT_EXISTS_AFTER_IF_ON_COLUMN"], ["NOT EXISTS"]>]
						: never
					: [R1, FormatError<Errors["EXPECTED_NOT_EXISTS_AFTER_IF_ON_COLUMN"], ["NOT EXISTS"]>]
				: PeekToken<R1> extends TokenKey<"exists">
					? [SkipToken<R1>, null]
					: [R1, FormatError<Errors["EXPECTED_NOT_EXISTS_AFTER_IF_ON_COLUMN"], ["EXISTS"]>]
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
				? ParseAlterConstraintBody<SkipToken<R1>, Db, Sch, Tab, CName> // the body records the name
				: ParseAlterConstraintBody<SkipToken<R1>, Db, Sch, Tab>
			: never
		: ParseAlterConstraintBody<Tokens, Db, Sch, Tab>

/**
 * The constraint after `ADD [CONSTRAINT name]`, checked as in CREATE TABLE (CORE-15, CORE-17): the columns of
 * PRIMARY KEY, UNIQUE and FOREIGN KEY must exist, the REFERENCES target too; CHECK and the rest are skipped.
 */
type ParseAlterConstraintBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	CName extends string = never,
> =
	PeekToken<Tokens> extends TokenKey<"primary" | "foreign">
		? [PeekToken<Tokens>, JsqlTablePrimaryKey<JsqlDbGetTable<Db, Sch, Tab>>] extends [
				TokenKey<"primary">,
				JsqlPrimaryKey,
			]
			? MultiplePrimaryKeys<Tokens, Db, Tab>
			: SkipToken<SkipToken<Tokens>> extends infer R1 extends ParserMonad
				? ParseAlterConstraintColumns<
						R1,
						Db,
						Sch,
						Tab,
						PeekToken<Tokens> extends TokenKey<"primary"> ? "PRIMARY KEY" : "FOREIGN KEY",
						CName
					>
				: never
		: PeekToken<Tokens> extends TokenKey<"unique">
			? ParseAlterConstraintColumns<SkipToken<Tokens>, Db, Sch, Tab, "UNIQUE", CName>
			: [PeekToken<Tokens>, CName, DialectFact<Db, "defaultConstraintNames">] extends [
						TokenKey<"check">,
						never,
						false,
				  ]
				? ParseAlterSkipAction<Tokens, Db, Sch, Tab>
				: PeekToken<Tokens> extends TokenKey<"check">
					? // #179: a CHECK involves the table's columns its expression names (#207: unnamed, its default name)
						ParenGroupNames<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
						? [E] extends [DbtyperErrorShape] // E is a union of names: no distribution
							? [R, Db, E]
							: Extract<E, keyof JsqlTableColumns<Db, Sch, Tab> & string> extends infer Used extends
										string
								? ParseAlterSkipAction<
										R,
										[CName] extends [never]
											? JsqlDbAddDefaultConstraint<Db, Sch, Tab, SingleName<Used>, "check", Used>
											: JsqlDbSetConstraintColumns<Db, Sch, Tab, CName, Used>,
										Sch,
										Tab
									>
								: never
						: never
					: ParseAlterSkipAction<Tokens, WithConstraintName<Db, Sch, Tab, CName>, Sch, Tab>

/** The name of `ADD CONSTRAINT name …` where no column list records it (PGT-25). */
type WithConstraintName<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, CName extends string> = [
	CName,
] extends [never]
	? Db
	: JsqlDbAddConstraintName<Db, Sch, Tab, CName>

/** At the `(` of the column list (a form without one, `UNIQUE USING INDEX i`, is skipped). */
type ParseAlterConstraintColumns<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Kind extends "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE",
	CName extends string = never,
> =
	PeekToken<R1> extends TokenKey<"(">
		? ParseNameList<SkipToken<R1>, readonly []> extends [infer R2 extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R2, Db, Names]
				: Names extends readonly string[]
					? Exclude<Names[number], keyof JsqlTableColumns<Db, Sch, Tab>> extends infer Missing extends string
						? [Missing] extends [never]
							? (
									[CName] extends [never]
										? Kind extends "UNIQUE"
											? // #207: an unnamed UNIQUE is `<table>_<columns>_key`
												JsqlDbAddDefaultConstraint<
													Db,
													Sch,
													Tab,
													JoinColumnNames<Names>,
													"key",
													Names[number]
												>
											: Db
										: Kind extends "FOREIGN KEY"
											? Db // recorded with the columns it references
											: JsqlDbSetConstraintColumns<Db, Sch, Tab, CName, Names[number]>
								) extends infer Db1 extends JsqlDatabaseShape
								? Kind extends "PRIMARY KEY"
									? ParseAlterSkipAction<
											R2,
											AlterPrimaryKeyNotNull<
												JsqlDbSetPrimaryKey<
													Db1,
													Sch,
													Tab,
													{
														columns: Names[number]
														name: [CName] extends [never] ? `${Tab}_pkey` : CName
													}
												>,
												Sch,
												Tab,
												Names
											>,
											Sch,
											Tab
										>
									: Kind extends "FOREIGN KEY"
										? ParseAlterForeignKeyTarget<R2, Db1, Sch, Tab, CName, Names>
										: ParseAlterSkipAction<R2, Db1, Sch, Tab>
								: never
							: SkipFailedStatement<R2, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Missing, Kind]>>
						: never
					: never
			: never
		: ParseAlterSkipAction<R1, WithConstraintName<Db, Sch, Tab, CName>, Sch, Tab>

/**
 * `REFERENCES target [(cols)] …` after the FOREIGN KEY columns: the target must exist (CORE-17). The constraint
 * records its columns and the ones it references (#207); unnamed, it is `<table>_<columns>_fkey`.
 */
type ParseAlterForeignKeyTarget<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	CName extends string,
	Names extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<"references">
		? ParseReferences<SkipToken<Tokens>, Db, "", ""> extends [infer R extends ParserMonad, infer E]
			? E extends { refs: infer Refs extends string }
				? ParseAlterSkipAction<
						R,
						[CName] extends [never]
							? JsqlDbAddDefaultConstraint<
									Db,
									Sch,
									Tab,
									JoinColumnNames<Names>,
									"fkey",
									Names[number],
									Refs
								>
							: JsqlDbSetConstraintColumns<Db, Sch, Tab, CName, Names[number], Refs>,
						Sch,
						Tab
					>
				: [R, Db, E]
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_REFERENCES_AFTER_FOREIGN_KEY"], []>>

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
				: ParseAlterAfterOptionalColumnKw<R0> extends [infer R1 extends ParserMonad, null]
					? PeekToken<R1> extends TokenKey<"if">
						? ParseColumnIfExists<R1, Db, false> extends [infer R2 extends ParserMonad, infer IfErr]
							? IfErr extends DbtyperErrorShape
								? SkipFailedStatement<R2, Db, IfErr>
								: ParseAlterDropColumnNamed<R2, Db, Sch, Tab, true>
							: never
						: ParseAlterDropColumnNamed<R1, Db, Sch, Tab, false>
					: never
			: never
		: never

/** `DROP [COLUMN] [IF EXISTS] name [CASCADE | RESTRICT]`; with IF EXISTS a missing column changes nothing. */
type ParseAlterDropColumnNamed<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	IfExists extends boolean,
> =
	AsIdent<PeekToken<R1>> extends TokenIdent<infer Col extends string>
		? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends null
			? IfExists extends true
				? ParseAlterDropColumnTail<SkipToken<R1>, Db, Sch, Tab>
				: [R1, Db, FormatError<Errors["COLUMN_DOES_NOT_EXIST"], [Col]>]
			: ParseAlterDropColumnTail<SkipToken<R1>, JsqlDbReplaceColumn<Db, Sch, Tab, Col, null>, Sch, Tab, Db, Col>
		: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["after DROP COLUMN"]>>

/**
 * SCHEMA-29: `CASCADE | RESTRICT` after a dropped column (PostgreSQL). #207: a FOREIGN KEY of any table that
 * references the column (`constraints.refs`) makes the drop an error without CASCADE (3213); CASCADE drops those
 * constraints (the dialect fact `dropReferencedColumn`). `Dropped` is the state with the column gone, `Before` the one
 * before; `Col` is never when nothing was dropped (IF EXISTS).
 */
type ParseAlterDropColumnTail<
	Tokens extends ParserMonad,
	Dropped extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Before extends JsqlDatabaseShape = Dropped,
	Col extends string = never,
> =
	PeekToken<Tokens> extends TokenIdent<"cascade" | "restrict">
		? DbDialectOnlyError<Dropped, "pg-drop-cascade"> extends infer OnlyErr extends DbtyperErrorShape
			? SkipFailedStatement<Tokens, Dropped, OnlyErr>
			: DropColumnDependents<Before, Sch, Tab, Col> extends infer Deps extends string
				? [Deps] extends [never]
					? ParseAlterActions<SkipToken<Tokens>, Dropped, Sch, Tab>
					: PeekToken<Tokens> extends TokenIdent<"cascade">
						? ParseAlterActions<
								SkipToken<Tokens>,
								JsqlDbDropReferencingConstraints<Dropped, `${Sch}.${Tab}.${Col}`>,
								Sch,
								Tab
							>
						: ReferencedColumnError<Tokens, Before, Col, Deps>
				: never
		: DropColumnDependents<Before, Sch, Tab, Col> extends infer Deps extends string
			? [Deps] extends [never]
				? ParseAlterActions<Tokens, Dropped, Sch, Tab>
				: ReferencedColumnError<Tokens, Before, Col, Deps>
			: never

/** #207: the FOREIGN KEYs (`table.constraint`) that keep column `Col` from being dropped without CASCADE. */
type DropColumnDependents<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, Col extends string> = [
	Col,
] extends [never]
	? never
	: DialectFact<Db, "dropReferencedColumn"> extends "cascade"
		? JsqlDbReferencingConstraints<
				Db,
				`${Sch}.${Tab}.${Col}`,
				// a constraint of the table that involves the column goes with it anyway
				JsqlTableConstraintsOn<JsqlDbGetTable<Db, Sch, Tab>, Tab, Col>
			>
		: never

type ReferencedColumnError<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Col extends string,
	Deps extends string,
> = SkipFailedStatement<
	Tokens,
	Db,
	FormatError<
		Errors["COLUMN_IS_REFERENCED_BY_A_FOREIGN_KEY"],
		[Col, LastOf<Deps> extends `${infer T}.${infer N}` ? `${N} of table ${T}` : never]
	>
>
