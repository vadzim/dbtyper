import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type {
	HasPrimaryKey,
	MultiplePrimaryKeys,
	PkKind,
	WithPendingConstraint,
	WithPendingConstraintColumns,
	WithPendingConstraintRefs,
	WithPendingDefaultConstraint,
} from "./parse-create-table.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbAddDefaultConstraint, JsqlDbSetConstraintColumns, JsqlDbSetProp } from "../core/jsql-utils.ts"
import type { SingleName } from "../core/jsql-constraint-names.ts"
import type { ParenGroupNames, SkipParenGroup } from "./parse-column-constraints.ts"
import type { ParseReferences } from "./parse-column-references.ts"
import type { FullAddColumn } from "./parse-column-alter-end.ts"
import type { ColumnCtx, ColumnGenericFail, ColumnState, ParseColumnConstraints } from "./parse-column-constraints.ts"
import type { ConflictActionToken } from "./parse-insert.ts"
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

/**
 * At `CONSTRAINT`: skip it and its name, which names the constraint that follows (#207: a PRIMARY KEY keeps it as its
 * name; UNIQUE, CHECK and REFERENCES get no default name then).
 */
export type ColumnConstraintName<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
			? ColumnNamedConstraint<
					SkipToken<R1>,
					ColumnCtxWithDb<
						C,
						// #179: the constraint involves this column; ALTER TABLE … ADD COLUMN records it on the table at once
						C["alter"] extends true
							? JsqlDbSetConstraintColumns<C["db"], C["schema"], C["table"], CName, C["name"]>
							: WithPendingConstraintColumns<WithPendingConstraint<C["db"], CName>, CName, C["name"]>
					>,
					S,
					CName
				>
			: ColumnFail<R1, C, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
		: never

/** The constraint after `CONSTRAINT name`. */
type ColumnNamedConstraint<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	CName extends string,
> =
	PeekToken<Tokens> extends TokenKey<"unique">
		? ColumnUnique<Tokens, C, S, CName>
		: PeekToken<Tokens> extends TokenKey<"check">
			? ColumnCheck<Tokens, C, S, CName>
			: PeekToken<Tokens> extends TokenKey<"references">
				? ColumnReferences<Tokens, C, S, CName>
				: PeekToken<Tokens> extends TokenKey<"primary">
					? HasPrimaryKey<C["stack"], S["pk"]> extends true
						? MultiplePrimaryKeys<Tokens, C["db"], C["table"]>
						: ColumnPrimaryKey<
								Tokens,
								ColumnCtxWithDb<C, JsqlDbSetProp<C["db"], "pendingPkName", CName>>,
								S
							>
					: ParseColumnConstraints<Tokens, C, S>

/** The column context with another database state. */
export type ColumnCtxWithDb<C extends ColumnCtx, Db extends JsqlDatabaseShape> = {
	db: Db
	schema: C["schema"]
	table: C["table"]
	stack: C["stack"]
	name: C["name"]
	type: C["type"]
	declared: C["declared"]
	alter: C["alter"]
}

/**
 * #207: the state after a column constraint `Label` (UNIQUE `key`, CHECK `check`, REFERENCES `fkey`): an unnamed one
 * is recorded under its default name (on the columns `Cols`, the name part `NamePart`); a named one (`Named`, recorded
 * at its name) gets its referenced columns `Refs`. ALTER TABLE … ADD COLUMN records on the table at once.
 */
type ColumnConstraintDb<
	C extends ColumnCtx,
	Named extends string,
	Label extends "key" | "fkey" | "check",
	NamePart extends string,
	Cols extends string,
	Refs extends string = never,
> = [Named] extends [never]
	? C["alter"] extends true
		? JsqlDbAddDefaultConstraint<C["db"], C["schema"], C["table"], NamePart, Label, Cols, Refs>
		: WithPendingDefaultConstraint<C["db"], C["table"], NamePart, Label, Cols, Refs>
	: [Refs] extends [never]
		? C["db"]
		: C["alter"] extends true
			? JsqlDbSetConstraintColumns<C["db"], C["schema"], C["table"], Named, C["name"], Refs>
			: WithPendingConstraintRefs<C["db"], Named, Refs>

/** At `CHECK (…)`; unnamed, its default name names the one column the expression names (#207). */
export type ColumnCheck<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	Named extends string = never,
> = [Named, DialectFact<C["db"], "defaultConstraintNames">] extends [never, true]
	? ParenGroupNames<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
		? [E] extends [DbtyperErrorShape] // E is a union of names: no distribution
			? [R, C["db"], E]
			: Extract<E, C["stack"][number][0] | C["name"]> extends infer Used extends string
				? ParseColumnConstraints<
						R,
						ColumnCtxWithDb<C, ColumnConstraintDb<C, never, "check", SingleName<Used>, Used | C["name"]>>,
						ColumnStateWith<S, {}>
					>
				: never
		: never
	: SkipParenGroup<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
		? ColumnAfterGroup<R, E, C, S>
		: never

/** At `REFERENCES …`: the target must exist (CORE-17); the constraint records the columns it references (#207). */
export type ColumnReferences<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	Named extends string = never,
> =
	ParseReferences<SkipToken<Tokens>, C["db"], C["schema"], C["table"]> extends [infer R extends ParserMonad, infer E]
		? E extends { refs: infer Refs extends string }
			? ParseColumnConstraints<
					R,
					ColumnCtxWithDb<C, ColumnConstraintDb<C, Named, "fkey", C["name"], C["name"], Refs>>,
					ColumnStateWith<S, {}>
				>
			: ColumnAfterGroup<R, E, C, S>
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
	FullAddColumn<C>,
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

/** At `UNIQUE`; SQLite: an `ON CONFLICT` clause may follow (SQLT-18). Unnamed: `<table>_<column>_key` (#207). */
export type ColumnUnique<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	Named extends string = never,
> = [C["alter"], FullAddColumn<C>] extends [true, never]
	? ColumnFail<Tokens, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["UNIQUE"]>>
	: [Named] extends [never]
		? ColumnOnConflict<
				SkipToken<Tokens>,
				ColumnCtxWithDb<C, ColumnConstraintDb<C, never, "key", C["name"], C["name"]>>,
				ColumnStateWith<S, {}>
			>
		: ColumnOnConflict<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>

/** After `PRIMARY KEY`; SQLite: `ASC` / `DESC` and `ON CONFLICT` may follow (SQLT-18). */
type ColumnPkTail<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "constraintOnConflict"> extends true
		? PeekToken<Tokens> extends TokenKey<"desc" | "asc">
			? ColumnOnConflict<SkipToken<Tokens>, C, S>
			: ColumnOnConflict<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/** SQLite (SQLT-18): an optional `ON CONFLICT <action>` after NOT NULL, UNIQUE, PRIMARY KEY; then more constraints. */
export type ColumnOnConflict<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "constraintOnConflict"> extends true
		? PeekToken<Tokens> extends TokenKey<"on">
			? OnConflictClause<Tokens> extends [infer R extends ParserMonad, infer Res]
				? Res extends DbtyperErrorShape
					? ColumnFail<R, C, Res>
					: Res extends "no-conflict"
						? ColumnGenericFail<R, C, S>
						: ParseColumnConstraints<R, C, S>
				: never
			: ParseColumnConstraints<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/**
 * SQLite (SQLT-18, SQLT-55): `ON CONFLICT <action>` after a column or a table constraint; the next token is `ON`.
 * `[rest, null]`, or `[rest, error]` for an unknown action word, or `[rest, "no-conflict"]` when `CONFLICT` does not follow.
 */
export type OnConflictClause<Tokens extends ParserMonad> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"conflict">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends ConflictActionToken
					? [SkipToken<R2>, null]
					: [R2, FormatError<Errors["UNKNOWN_CONFLICT_ACTION"], []>]
				: never
			: [R1, "no-conflict"]
		: never

/** At `AS (expr) [STORED | VIRTUAL]`: SQLite's short form of a generated column (SQLT-18). */
export type ColumnShortGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "shortGenerated"> extends true
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
