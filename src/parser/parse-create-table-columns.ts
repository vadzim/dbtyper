import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { JsqlCreateTable, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type {
	ColumnDef,
	ParseCreateTableCloseParenAndSemi,
	PendingConstraints,
	ColumnNameToken,
	PendingSpelled,
	StackOrder,
	PendingPkName,
	StackPrimaryKey,
	WithColumnSpelling,
	WithoutPending,
} from "./parse-create-table.ts"
import type { ParseRowidTableEnd, TableConstraintStart } from "./parse-create-table-sqlite-end.ts"
import type { ColumnsFromStack } from "./parse-create-table-merge.ts"
import type { ParseTableConstraint } from "./parse-table-constraints.ts"
import type { ParseColumnConstraints, SerialName } from "./parse-column-constraints.ts"

export type ParseCreateTableBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? DialectFact<Db, "rowidTables"> extends true
			? ParseRowidTableEnd<Tokens, Db, Schema, Table, Stack>
			: ColumnsFromStack<Stack> extends infer M extends {
						cols: Record<string, SqlTypeShape>
						facts: Record<string, unknown>
				  }
				? JsqlDbReplaceData<
						WithoutPending<Db>,
						Schema,
						Table,
						JsqlCreateTable<
							M["cols"],
							M["facts"],
							PendingConstraints<Db>,
							StackOrder<Stack>,
							PendingSpelled<Db, Stack[number][0]>,
							StackPrimaryKey<Stack>,
							PendingPkName<Db, Table>
						>
					> extends infer NewDb
					? NewDb extends JsqlDatabaseShape
						? ParseCreateTableCloseParenAndSemi<Tokens, NewDb>
						: never
					: never
				: never
		: PeekToken<Tokens> extends TableConstraintStart
			? ParseTableConstraint<Tokens, Db, Schema, Table, Stack>
			: ParseOneColumn<Tokens, Db, Schema, Table, Stack>

/** After the `,` between two definitions: a column or a table constraint must follow, not `)`. */
export type ParseCreateTableAfterComma<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_COLUMN_AFTER_COMMA_IN_CREATE_TABLE"], []>>
		: ParseCreateTableBody<Tokens, Db, Schema, Table, Stack>

type ParseOneColumn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	ColumnNameToken<PeekToken<Tokens>, Db> extends infer NameTok
		? NameTok extends TokenIdent<infer ColName extends string>
			? ColName extends Stack[number][0]
				? SkipFailedStatement<Tokens, Db, FormatError<Errors["COLUMN_ALREADY_EXISTS"], [ColName]>>
				: Stack["length"] extends ColumnChunkEnd
					? ParseOneColumnAfterColName<
							SkipToken<Tokens>,
							WithColumnSpelling<Db, ColName, NameTok>,
							Schema,
							Table,
							Stack,
							ColName
						> extends [infer M extends ParserMonad, ...infer R]
						? [M, ...R]
						: never
					: ParseOneColumnAfterColName<
							SkipToken<Tokens>,
							WithColumnSpelling<Db, ColName, NameTok>,
							Schema,
							Table,
							Stack,
							ColName
						>
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in CREATE TABLE"]>>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in CREATE TABLE"]>>

/**
 * TLVL-4, #142: the column list is parsed by tail recursion, about 5 steps per column (more with constraints and
 * DEFAULT), and TypeScript stops a tail recursion at 1000 steps: about 200 plain columns. Every 50 columns (the 50
 * is measured: 50 columns = about 250 steps, well under 1000, and 20 restarts of one depth level each fit the depth
 * limit 100) the rest of the list is parsed inside a nested (not tail) instantiation, which starts a new count: about
 * 1000 columns fit. Normal tables (under 50 columns) never take this branch. Test: test/stress/wide-table-300.
 */
type ColumnChunkEnd =
	| 50
	| 100
	| 150
	| 200
	| 250
	| 300
	| 350
	| 400
	| 450
	| 500
	| 550
	| 600
	| 650
	| 700
	| 750
	| 800
	| 850
	| 900
	| 950
	| 1000

export type ParseOneColumnAfterColName<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> =
	// SQLT-10: a SQLite column may have no type: the next token is not a type word (`ANY` is a keyword, `COLLATE` a name)
	DialectFact<Db, "typelessColumns"> extends true
		? PeekToken<AfterColName> extends TokenKey<"any">
			? ParseColumnConstraints<
					SkipToken<AfterColName>,
					{
						db: Db
						schema: Schema
						table: Table
						stack: Stack
						name: ColName
						type: AnyTypeShape
						declared: "any"
						alter: Alter
					},
					{ nn: false; def: false; gen: false; afterDefault: false; pk: false }
				>
			: PeekToken<AfterColName> extends TokenIdent<"collate">
				? ParseOneColumnTypeless<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
				: PeekToken<AfterColName> extends TokenIdent<string>
					? ParseOneColumnTyped<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
					: ParseOneColumnTypeless<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
		: ParseOneColumnTyped<AfterColName, Db, Schema, Table, Stack, ColName, Alter>

/** SQLT-10: the type of a column declared without one (or as `ANY`). */
type AnyTypeShape = { type: "any"; arg: null; nullable: true }

type ParseOneColumnTypeless<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> = ParseColumnConstraints<
	AfterColName,
	{
		db: Db
		schema: Schema
		table: Table
		stack: Stack
		name: ColName
		type: AnyTypeShape
		declared: ""
		alter: Alter
	},
	{ nn: false; def: false; gen: false; afterDefault: false; pk: false }
>

type ParseOneColumnTyped<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> =
	ParseSqlType<AfterColName, Db, true, Schema> extends [infer AfterType extends ParserMonad, infer TypeShape]
		? TypeShape extends DbtyperErrorShape
			? [AfterType, Db, TypeShape]
			: TypeShape extends SqlTypeShape
				? ParseColumnConstraints<
						AfterType,
						{
							db: Db
							schema: Schema
							table: Table
							stack: Stack
							name: ColName
							type: { type: TypeShape["type"]; arg: TypeShape["arg"]; nullable: TypeShape["nullable"] }
							declared: TypeShape extends { declared: infer Declared extends string } ? Declared : ""
							alter: Alter
						},
						{
							// PGT-6: a serial column is NOT NULL and has an implicit DEFAULT nextval(...): optional in INSERT
							nn: TypeShape extends { declared: SerialName }
								? true
								: TypeShape["nullable"] extends false
									? true
									: false
							def: TypeShape extends { declared: SerialName } ? true : false
							gen: false
							afterDefault: false
							pk: false
						}
					>
				: [AfterType, Db, FormatError<Errors["EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE"], []>]
		: never
