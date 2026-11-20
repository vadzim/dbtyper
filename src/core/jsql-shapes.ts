import type { SqlTypeShape } from "./sql-type-shape.ts"

export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: unknown
	/** The dialect of the chain (DSEL-1), when it is not PostgreSQL: see `DialectFact` (src/core/dialect.ts). */
	dialect?: string
	/** Constraint names seen while a CREATE TABLE is parsed (PGT-25); never in a finished state. */
	pendingConstraints?: string
	/** Set while the INSERT / UPDATE / DELETE of a data-modifying CTE is parsed: it ends at `)` (PGT-26). */
	cteDml?: true
	/** SQLite: declared spellings of the columns of the CREATE TABLE / ADD COLUMN being parsed (SQLT-28); never in a finished state. */
	pendingSpelled?: Record<string, string>
	/** The name of the CREATE TABLE's named table PRIMARY KEY constraint (CORE-15); never in a finished state. */
	pendingPkName?: string
	/** The columns of the CREATE TABLE's named constraints, name -> union (#179); never in a finished state. */
	pendingConstraintColumns?: unknown
	/** The columns each FOREIGN KEY of the CREATE TABLE references, name -> union (#207); never in a finished state. */
	pendingConstraintRefs?: unknown
	/** The name of the CREATE TABLE's named table constraint being parsed (#179); never in a finished state. */
	pendingTableConstraint?: string
	/** The CREATE TABLE's columns of a domain or composite type, name -> `schema.type` (#179); never in a finished state. */
	pendingUserTypes?: Record<string, string>
	/** Set while the SELECT of a CREATE VIEW is parsed: the result names the user types it reads (#207); never in a finished state. */
	pendingView?: true
	/** Set while the SELECT of an `INSERT … SELECT` is parsed: the columns match by position, so no output name is needed (#166). */
	positionalSelect?: true
}

export type JsqlSchemaShape = {
	/** Named relations in the schema (base tables and views). */
	sets: unknown
	/** Named types in the schema (enums, etc.). */
	types?: unknown
}

export type JsqlTypeShape =
	| {
			kind: "enum"
			/** Enum values in order. */
			values: readonly string[]
	  }
	| {
			kind: "domain"
			/** The base type, already resolved (PGT-22). */
			base: SqlTypeShape
			/** The domain says NOT NULL: columns of it are NOT NULL. */
			notNull: boolean
	  }
	| {
			/** `CREATE TYPE t AS (…)` (PGT-15): no TypeScript mapping; its attributes are not typed. */
			kind: "composite"
	  }

export type JsqlDataShape<Kind extends "table" | "view" = "table" | "view"> = {
	kind: Kind
	/** SQL types per column as SqlTypeShape objects. */
	columns: Record<string, SqlTypeShape>
	column_facts?: unknown
	constraints?: unknown
	/** The column keys in declaration order (SCHEMA-10): INSERT without a column list, `*` (#150). */
	order?: unknown
	/** SQLite: the declared spelling of each column whose key (lower case) differs from it; the result key (SQLT-28, #151). */
	spelled?: unknown
	/** The PRIMARY KEY, `JsqlPrimaryKey` (src/core/jsql-utils.ts): columns and constraint name (CORE-15, SEL-27). */
	primary_key?: unknown
	/** SQLite: the names of the table's indexes, a union (`CREATE INDEX`, for `INDEXED BY`; src/parser/parse-index.ts, SQLT-74). */
	indexes?: unknown
	/** The columns of a domain or composite type: name -> `schema.type` (TYPE-18, #179); absent when none. */
	user_types?: unknown
}

export type JsqlColumnFactsEntry = {
	default?: true | undefined
	check?: true | undefined
	generated?: true | { mode: "stored" | "virtual" } | undefined
	/** `GENERATED ALWAYS AS IDENTITY`: `generated` too, but writable with OVERRIDING (PGT-25). */
	identity?: true | undefined
	nullability?: "not_null" | "nullable" | undefined
}

type JsqlReturningResult = {
	returning: Record<string, SqlTypeShape> | null
}

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = JsqlReturningResult & {
	kind: "select"
	returning: Record<string, SqlTypeShape>
}

/** Type-level result of a parsed `INSERT` (DB state unchanged in this model). */
export type JsqlInsertStatementResult = JsqlReturningResult & {
	kind: "insert"
	table: string
	schema: string
	columns: readonly string[]
	/** Set when `ON CONFLICT … DO UPDATE SET …` is parsed (assigned column names only). */
	on_conflict_update_set_columns?: readonly string[]
}

/** Type-level result of a parsed `UPDATE` (DB state unchanged in this model). */
export type JsqlUpdateStatementResult = {
	kind: "update"
	table: string
	schema: string
	/** Column names that appeared in `SET` (each assignment is type-checked). */
	set_columns: readonly string[]
}
