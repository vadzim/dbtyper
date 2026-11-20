import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type {
	ColumnDef,
	HasPrimaryKey,
	MultiplePrimaryKeys,
	PkKind,
	WithPendingConstraint,
} from "./parse-create-table.ts"
import type { OnConflictClause } from "./parse-column-constraint-clauses.ts"
import type { SkipParenGroup } from "./parse-column-constraints.ts"
import type { ParseReferences } from "./parse-column-references.ts"
import type { ParseCreateTableAfterComma, ParseCreateTableBody } from "./parse-create-table-columns.ts"

/**
 * `a, b, c)` after `(`: `[rest after ")", names]` or `[rest, error]`. With `Ordered` (SQLite table PRIMARY KEY and
 * UNIQUE, SQLT-18) each name may be followed by `COLLATE x` and `ASC` / `DESC`.
 */
export type ParseNameList<Tokens extends ParserMonad, Acc extends readonly string[], Ordered extends boolean = false> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer N extends string>
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? SkipOrderedSuffix<R0, Ordered> extends [infer R1 extends ParserMonad, null]
				? PeekToken<R1> extends TokenKey<",">
					? ParseNameList<SkipToken<R1>, readonly [...Acc, N], Ordered>
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, N]]
						: SkipFailedExpression<
								R1,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
							>
				: never
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in CREATE TABLE constraint"]>>

/** `[COLLATE x] [ASC | DESC]` after a name of an ordered list: `[rest, null]`. */
type SkipOrderedSuffix<Tokens extends ParserMonad, Ordered extends boolean> = Ordered extends true
	? PeekToken<Tokens> extends TokenIdent<"collate">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? SkipOrderedSuffix<SkipToken<R1>, true>
			: never
		: PeekToken<Tokens> extends TokenKey<"asc" | "desc">
			? [SkipToken<Tokens>, null]
			: [Tokens, null]
	: [Tokens, null]

/**
 * A table constraint (CORE-15), named or not: `PRIMARY KEY (cols)` makes its columns NOT NULL (CORE-1);
 * `UNIQUE (cols)`, `CHECK (…)`, `FOREIGN KEY (cols) REFERENCES …` change no type. Columns must already be declared.
 */
export type ParseTableConstraint<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<"constraint">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? TableConstraintBody<
							R2,
							WithPendingConstraint<Db, CName> extends infer Db1 extends JsqlDatabaseShape
								? PeekToken<R2> extends TokenKey<"primary">
									? Db1 & { pendingPkName: CName }
									: Db1
								: never,
							Schema,
							Table,
							Stack
						>
					: never
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
			: never
		: TableConstraintBody<Tokens, Db, Schema, Table, Stack>

type TableConstraintBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> = [PeekToken<Tokens>, HasPrimaryKey<Stack>] extends [TokenKey<"primary">, true]
	? MultiplePrimaryKeys<Tokens, Db, Table>
	: PeekToken<Tokens> extends TokenKey<"primary" | "foreign">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"key">
				? TableConstraintColumns<
						SkipToken<R1>,
						Db,
						Schema,
						Table,
						Stack,
						PeekToken<Tokens> extends TokenKey<"primary"> ? "PRIMARY KEY" : "FOREIGN KEY"
					>
				: SkipFailedStatement<
						R1,
						Db,
						FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>
					>
			: never
		: PeekToken<Tokens> extends TokenKey<"unique">
			? TableConstraintColumns<SkipToken<Tokens>, Db, Schema, Table, Stack, "UNIQUE">
			: PeekToken<Tokens> extends TokenKey<"check">
				? SkipParenGroup<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
					? E extends DbtyperErrorShape
						? [R, Db, E]
						: AfterTableConstraint<R, Db, Schema, Table, Stack>
					: never
				: SkipFailedStatement<
						Tokens,
						Db,
						FormatError<Errors["EXPECTED_CONSTRAINT_AFTER_NAME_IN_CREATE_TABLE"], []>
					>

type TableConstraintColumns<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Kind extends string,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseNameList<
				SkipToken<Tokens>,
				readonly [],
				Kind extends "FOREIGN KEY" ? false : DialectFact<Db, "constraintOnConflict">
			> extends [infer R extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R, Db, Names]
				: Names extends readonly string[]
					? Exclude<Names[number], Stack[number][0]> extends infer Missing extends string
						? [Missing] extends [never]
							? TableConstraintAfterColumns<
									R,
									Db,
									Schema,
									Table,
									Stack,
									Kind,
									Names[number],
									Names["length"] extends 1 ? true : false
								>
							: SkipFailedStatement<R, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Missing, Kind]>>
						: never
					: never
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT"], []>>

/** After the column list: a FOREIGN KEY needs REFERENCES; a PRIMARY KEY marks its columns NOT NULL (CORE-1). */
type TableConstraintAfterColumns<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Kind extends string,
	Names extends string,
	Single extends boolean,
> = Kind extends "FOREIGN KEY"
	? PeekToken<Tokens> extends TokenKey<"references">
		? ParseReferences<SkipToken<Tokens>, Db, Schema, Table> extends [infer R2 extends ParserMonad, infer E]
			? E extends DbtyperErrorShape
				? [R2, Db, E]
				: AfterTableConstraint<R2, Db, Schema, Table, Stack>
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_REFERENCES_AFTER_FOREIGN_KEY"], []>>
	: AfterTableConstraint<
			Tokens,
			Db,
			Schema,
			Table,
			Kind extends "PRIMARY KEY" ? MarkNotNull<Stack, Names, DialectFact<Db, "pkImpliesNotNull">, Single> : Stack
		>

type AfterTableConstraint<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseCreateTableAfterComma<SkipToken<Tokens>, Db, Schema, Table, Stack>
		: PeekToken<Tokens> extends TokenKey<")">
			? ParseCreateTableBody<Tokens, Db, Schema, Table, Stack>
			: PeekToken<Tokens> extends TokenIdent<"deferrable" | "initially"> | TokenKey<"not">
				? // PGT-18: `[NOT] DEFERRABLE`, `INITIALLY DEFERRED | IMMEDIATE` change nothing the types see
					TableConstraintDeferrable<Tokens, Db, Schema, Table, Stack>
				: PeekToken<Tokens> extends TokenKey<"on">
					? // SQLite (SQLT-18): `ON CONFLICT <action>` after a table constraint
						DialectFact<Db, "constraintOnConflict"> extends true
						? OnConflictClause<Tokens> extends [infer R extends ParserMonad, infer Res]
							? Res extends null
								? AfterTableConstraint<R, Db, Schema, Table, Stack>
								: SkipFailedStatement<
										R,
										Db,
										Res extends DbtyperErrorShape
											? Res
											: FormatError<
													Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"],
													[]
												>
									>
							: never
						: SkipFailedStatement<
								Tokens,
								Db,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
							>
					: SkipFailedStatement<
							Tokens,
							Db,
							FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
						>

type TableConstraintDeferrable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<Tokens> extends TokenIdent<"initially">
			? AfterTableConstraint<SkipToken<R1>, Db, Schema, Table, Stack>
			: AfterTableConstraint<R1, Db, Schema, Table, Stack>
		: never

type MarkNotNull<
	Stack extends readonly ColumnDef[],
	Names extends string,
	Implies extends boolean,
	Single extends boolean,
> = {
	[I in keyof Stack]: Stack[I] extends readonly [
		infer N extends string,
		infer T extends SqlTypeShape,
		infer Nn extends boolean,
		infer D extends boolean,
		infer G extends boolean | "identity",
		infer _Pk extends PkKind,
		infer Decl extends string,
	]
		? N extends Names
			? readonly [
					N,
					T,
					Implies extends true ? true : Nn,
					D,
					G,
					Single extends true ? "single" : "composite",
					Decl,
				]
			: Stack[I]
		: never
}
