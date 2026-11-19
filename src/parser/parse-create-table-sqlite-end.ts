import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SqliteStrictTypeNames } from "../core/dialect.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { JsqlCreateTable, JsqlCreateRowidTable, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ColumnDef, PkKind, TableOptions } from "./parse-create-table.ts"
import type { ColumnsFromStack } from "./parse-create-table-merge.ts"

export type TableConstraintStart =
	| TokenKey<"constraint">
	| TokenKey<"primary">
	| TokenKey<"unique">
	| TokenKey<"check">
	| TokenKey<"foreign">

/**
 * SQLite: after the column list `)`: the table options (`STRICT`, `WITHOUT ROWID`, comma separated, SQLT-18), the
 * STRICT type check (SQLT-11), then NOT NULL of the primary key and the rowid alias per table kind (SQLT-13, SQLT-14).
 */
export type ParseSqliteTableEnd<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? ParseTableOptions<R1, { strict: false; withoutRowid: false }> extends [
				infer R2 extends ParserMonad,
				infer Opts,
			]
			? Opts extends DbtyperErrorShape
				? SkipFailedStatement<R2, Db, Opts>
				: Opts extends TableOptions
					? Opts["strict"] extends true
						? StrictViolation<Stack> extends false
							? SqliteTableBuilt<R2, Db, Schema, Table, Stack, Opts>
							: SkipFailedStatement<R2, Db, FormatError<Errors["STRICT_TABLE_TYPE_NOT_ALLOWED"], []>>
						: SqliteTableBuilt<R2, Db, Schema, Table, Stack, Opts>
					: never
			: never
		: never

/** `true` when a column of a STRICT table has a declared type name that STRICT does not allow (SQLT-11). */
type StrictViolation<Stack extends readonly ColumnDef[]> = true extends {
	[I in keyof Stack]: Stack[I][6] extends "" | SqliteStrictTypeNames ? false : true
}[number]
	? true
	: false

/** `STRICT`, `WITHOUT ROWID`, in any order, comma separated; `[rest, options | error]`. */
type ParseTableOptions<Tokens extends ParserMonad, Acc extends TableOptions> =
	PeekToken<Tokens> extends TokenIdent<"strict">
		? AfterTableOption<SkipToken<Tokens>, { strict: true; withoutRowid: Acc["withoutRowid"] }>
		: PeekToken<Tokens> extends TokenIdent<"without">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenIdent<"rowid">
					? AfterTableOption<SkipToken<R1>, { strict: Acc["strict"]; withoutRowid: true }>
					: [R1, FormatError<Errors["EXPECTED_TABLE_OPTION_IN_CREATE_TABLE"], []>]
				: never
			: [Tokens, Acc]

type AfterTableOption<Tokens extends ParserMonad, Acc extends TableOptions> =
	PeekToken<Tokens> extends TokenKey<","> ? ParseTableOptions<SkipToken<Tokens>, Acc> : [Tokens, Acc]

/** SQLT-18: a WITHOUT ROWID table needs a PRIMARY KEY (a column or a table constraint). */
type SqliteTableBuilt<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Opts extends TableOptions,
> = Opts["withoutRowid"] extends true
	? true extends { [I in keyof Stack]: Stack[I][5] extends false ? false : true }[number]
		? SqliteTableBuiltOk<Tokens, Db, Schema, Table, Stack, Opts>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["WITHOUT_ROWID_NEEDS_PRIMARY_KEY"], []>>
	: SqliteTableBuiltOk<Tokens, Db, Schema, Table, Stack, Opts>

type SqliteTableBuiltOk<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Opts extends TableOptions,
> =
	ColumnsFromStack<SqlitePrimaryKeys<Stack, Opts>> extends infer M extends {
		cols: Record<string, SqlTypeShape>
		facts: Record<string, unknown>
	}
		? JsqlDbReplaceData<
				Db,
				Schema,
				Table,
				Opts["withoutRowid"] extends true
					? JsqlCreateTable<M["cols"], M["facts"]>
					: JsqlCreateRowidTable<M["cols"], M["facts"], RowidAliasOf<Stack>>
			> extends infer NewDb extends JsqlDatabaseShape
			? PeekToken<Tokens> extends TokenKey<";"> | TokenEot
				? [SkipToken<Tokens>, NewDb, null]
				: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE TABLE"]>>
			: never
		: never

/**
 * SQLT-13, SQLT-14: a primary key column is NOT NULL in a STRICT or WITHOUT ROWID table, or when it is the rowid
 * (alone, declared exactly INTEGER; it is then also optional in INSERT, DML-4); else it stays as declared.
 */
type SqlitePrimaryKeys<Stack extends readonly ColumnDef[], Opts extends TableOptions> = {
	[I in keyof Stack]: Stack[I] extends readonly [
		infer N extends string,
		infer T extends SqlTypeShape,
		infer Nn extends boolean,
		infer D extends boolean,
		infer G extends boolean | "identity",
		infer Pk extends PkKind,
		infer Decl extends string,
	]
		? Pk extends false
			? Stack[I]
			: Opts["withoutRowid"] extends true
				? readonly [N, T, true, D, G, Pk, Decl]
				: Opts["strict"] extends true
					? readonly [N, T, true, D, G, Pk, Decl]
					: [Pk, Decl] extends ["single", "integer"]
						? readonly [N, T, true, true, G, Pk, Decl]
						: readonly [N, T, Nn, D, G, Pk, Decl]
		: never
}

/** SQLT-13, SQLT-15: the name of the column that is the rowid alias (declared exactly INTEGER PRIMARY KEY), else `never`. */
type RowidAliasOf<Stack extends readonly ColumnDef[]> = {
	[I in keyof Stack]: [Stack[I][5], Stack[I][6]] extends ["single", "integer"] ? Stack[I][0] : never
}[number]
