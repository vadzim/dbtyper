import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { PkKind, WithPendingConstraint } from "./parse-create-table.ts"
import type { PgAlter } from "./parse-column-alter-end.ts"
import type { ColumnCtx, ColumnGenericFail, ColumnState, ParseColumnConstraints } from "./parse-column-constraints.ts"
import type { ColumnGeneratedBody } from "./parse-column-generated.ts"

/** At `AUTOINCREMENT` (SQLite, SQLT-16): only on a column declared exactly `INTEGER PRIMARY KEY`. */
export type ColumnAutoincrement<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "rowidTables"> extends true
		? S["pk"] extends "single"
			? C["declared"] extends "integer"
				? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>
				: ColumnFail<Tokens, C, FormatError<Errors["AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY"], []>>
			: ColumnFail<Tokens, C, FormatError<Errors["AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY"], []>>
		: ColumnGenericFail<Tokens, C, S>

/** At `CONSTRAINT`: skip it and its name. */
export type ColumnConstraintName<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
			? ParseColumnConstraints<
					SkipToken<R1>,
					{
						db: WithPendingConstraint<C["db"], CName>
						schema: C["schema"]
						table: C["table"]
						stack: C["stack"]
						name: C["name"]
						type: C["type"]
						declared: C["declared"]
						alter: C["alter"]
					},
					S
				>
			: ColumnFail<R1, C, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
		: never

/** At `NOT`: `NOT NULL` after the type (CORE-15). */
export type ColumnNotNull<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"null">
			? ColumnOnConflict<SkipToken<R1>, C, ColumnStateWith<S, { nn: true }>>
			: PeekToken<R1> extends TokenIdent<"deferrable">
				? ParseColumnConstraints<SkipToken<R1>, C, ColumnStateWith<S, {}>>
				: ColumnFail<R1, C, FormatError<Errors["EXPECTED_NULL_AFTER_NOT"], []>>
		: never

/** At `PRIMARY`: `PRIMARY KEY` makes the column NOT NULL (CORE-1). */
export type ColumnPrimaryKey<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = [
	C["alter"],
	PgAlter<C>,
] extends [true, never]
	? ColumnFail<Tokens, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["PRIMARY KEY"]>>
	: SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"key">
			? ColumnPkTail<
					SkipToken<R1>,
					C,
					DialectFact<C["db"], "pkImpliesNotNull"> extends true
						? ColumnStateWith<S, { nn: true; pk: "single" }>
						: ColumnStateWith<S, { pk: "single" }>
				>
			: ColumnFail<R1, C, FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>>
		: never

/** At `UNIQUE`; SQLite: an `ON CONFLICT` clause may follow (SQLT-18). */
export type ColumnUnique<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = [
	C["alter"],
	PgAlter<C>,
] extends [true, never]
	? ColumnFail<Tokens, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["UNIQUE"]>>
	: ColumnOnConflict<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>

/** After `PRIMARY KEY`; SQLite: `ASC` / `DESC` and `ON CONFLICT` may follow (SQLT-18). */
type ColumnPkTail<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? PeekToken<Tokens> extends TokenKey<"desc" | "asc">
			? ColumnOnConflict<SkipToken<Tokens>, C, S>
			: ColumnOnConflict<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/** SQLite (SQLT-18): an optional `ON CONFLICT <action>` after NOT NULL, UNIQUE, PRIMARY KEY; then more constraints. */
export type ColumnOnConflict<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? PeekToken<Tokens> extends TokenKey<"on">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"conflict">
					? ParseColumnConstraints<SkipToken<SkipToken<R1>>, C, S>
					: ColumnGenericFail<R1, C, S>
				: never
			: ParseColumnConstraints<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/** At `AS (expr) [STORED | VIRTUAL]`: SQLite's short form of a generated column (SQLT-18). */
export type ColumnShortGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? ColumnGeneratedBody<SkipToken<Tokens>, C, S>
		: ColumnGenericFail<Tokens, C, S>

/** At `COLLATE`: skip it and the collation name (quoted or not, possibly qualified). */
export type ColumnCollate<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? PeekToken<R2> extends TokenKey<".">
				? SkipToken<R2> extends infer R3 extends ParserMonad
					? ParseColumnConstraints<SkipToken<R3>, C, ColumnStateWith<S, {}>>
					: never
				: ParseColumnConstraints<R2, C, ColumnStateWith<S, {}>>
			: never
		: never

/** `S` with some fields replaced; `afterDefault` is reset unless the patch sets it. */
export type ColumnStateWith<S extends ColumnState, Patch extends Partial<ColumnState>> = {
	nn: Patch extends { nn: infer V extends boolean } ? V : S["nn"]
	def: Patch extends { def: infer V extends boolean } ? V : S["def"]
	gen: Patch extends { gen: infer V extends boolean | "identity" } ? V : S["gen"]
	afterDefault: Patch extends { afterDefault: infer V extends boolean } ? V : false
	pk: Patch extends { pk: infer V extends PkKind } ? V : S["pk"]
}

export type ColumnEntry<C extends ColumnCtx, S extends ColumnState> = readonly [
	C["name"],
	C["type"],
	S["nn"],
	S["def"],
	S["gen"],
	S["pk"],
	C["declared"],
]

export type ColumnFail<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	Err extends DbtyperErrorShape,
> = SkipFailedStatement<Tokens, C["db"], Err>

/** After a constraint helper `[rest, null | error]`: go on with the column or fail the statement. */
export type ColumnAfterGroup<
	R extends ParserMonad,
	E,
	C extends ColumnCtx,
	S extends ColumnState,
> = E extends DbtyperErrorShape ? [R, C["db"], E] : ParseColumnConstraints<R, C, ColumnStateWith<S, {}>>
