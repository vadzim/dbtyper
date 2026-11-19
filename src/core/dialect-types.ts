/**
 * Type-name rows of the dialect seam (DLCT-5, SQLT-6…SQLT-11, SQLT-15): the written type name of a column or a CAST,
 * as data per dialect. Split out of dialect.ts (MOD-1); the facts they read are the `Dialects` table there.
 */
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { DialectFact, DialectOnlyError, PgOnlyTypeNames } from "./dialect.ts"

/**
 * SQLT-6: the affinity SQLite derives from a declared type name (lower-case, words joined by one space), by its
 * five rules in order; SQLT-8 / SQLT-9 / SQLT-11 name exceptions that keep a name apart. The result is the type name
 * of the column's shape: a key of the SQLite driver's type map (`integer`, `real`, `text`, `numeric`, `blob`,
 * `boolean`, `any`).
 */
type SqliteTypeKey<Name extends string> = Name extends "any"
	? "any"
	: Name extends "boolean" | "bool"
		? "boolean"
		: Name extends "date" | "datetime" | "timestamp" | "time" | "json"
			? "text"
			: Name extends `${string}int${string}`
				? "integer"
				: Name extends `${string}char${string}` | `${string}clob${string}` | `${string}text${string}`
					? "text"
					: Name extends `${string}blob${string}`
						? "blob"
						: Name extends `${string}real${string}` | `${string}floa${string}` | `${string}doub${string}`
							? "real"
							: "numeric"

/** DLCT-5: the type-name aliases of a `named` dialect (PostgreSQL) and the canonical name each gets. */
export type NormalizeSqlTypeName<T extends string> = T extends "int" | "int4"
	? "integer"
	: T extends "serial" | "serial4"
		? "integer"
		: T extends "smallserial" | "serial2"
			? "smallint"
			: T extends "bigserial" | "serial8"
				? "bigint"
				: T extends "timestamptz"
					? "timestamp with time zone"
					: T extends "timetz"
						? "time with time zone"
						: T extends "int2"
							? "smallint"
							: T extends "int8"
								? "bigint"
								: T extends "float8" | "double precision"
									? "double precision"
									: T extends "float4"
										? "real"
										: T extends "bool"
											? "boolean"
											: T extends "character varying"
												? "varchar"
												: T

/**
 * DLCT-5: the type-name table of the chain's dialect, one place for every rule that reads a written type name
 * (casts, column types). A column type: PostgreSQL normalizes aliases, SQLite derives the affinity key from the name
 * (SQLT-6…SQLT-9). SQLT-17: a SERIAL name in a SQLite chain gives the other-dialect error instead (with a hint).
 */
export type DialectColumnTypeName<Db, T extends string> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? T extends "serial" | "bigserial" | "smallserial" | "serial2" | "serial4" | "serial8"
			? DialectOnlyError<"dialect:sqlite", "pg-serial">
			: T extends keyof PgOnlyTypeNames
				? DialectOnlyError<"dialect:sqlite", PgOnlyTypeNames[T]>
				: SqliteTypeKey<T>
		: NormalizeSqlTypeName<T>

/**
 * DLCT-5: a CAST row of a `named` dialect: `[type of the result, guard]`. A name that is not listed is its own type
 * with no guard. Guards: "no-boolean" = a boolean value cannot be cast (CANNOT_CAST_BOOLEAN_TO_INTEGER), "no-number" =
 * a number cannot be cast (CANNOT_CAST_INTEGER_TO_BOOLEAN), "none".
 */
type NamedCastRows = {
	text: ["text", "none"]
	varchar: ["text", "none"]
	"character varying": ["text", "none"]
	char: ["text", "none"]
	integer: ["integer", "no-boolean"]
	int: ["integer", "no-boolean"]
	int4: ["integer", "no-boolean"]
	smallint: ["integer", "no-boolean"]
	int2: ["integer", "no-boolean"]
	serial: ["integer", "no-boolean"]
	smallserial: ["integer", "no-boolean"]
	bigint: ["bigint", "no-boolean"]
	int8: ["bigint", "no-boolean"]
	bigserial: ["bigint", "no-boolean"]
	boolean: ["boolean", "no-number"]
	bool: ["boolean", "no-number"]
	real: ["real", "none"]
	float4: ["real", "none"]
	"double precision": ["double precision", "none"]
	float8: ["double precision", "none"]
	numeric: ["numeric", "none"]
	decimal: ["numeric", "none"]
}

/**
 * DLCT-5: the CAST row of a written type name in the chain's dialect: `[type name of the result, guard]`. A `named`
 * dialect reads {@link NamedCastRows}; an `affinity` dialect gives the type of the name's affinity (SQLT-6), from any value.
 */
export type DialectCastRow<Db, N extends string> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? [SqliteTypeKey<N>, "none"]
		: N extends keyof NamedCastRows
			? NamedCastRows[N]
			: [N, "none"]

/**
 * DLCT-5: the error for a value that does not fit a column's type in INSERT / UPDATE (SQLT-43: where SQLite would
 * coerce, dbtyper names the column's storage class; elsewhere the value type is incompatible).
 */
export type ValueMismatchError<Db, Col extends string, ColType extends string> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? FormatError<Errors["COLUMN_TYPE_MISMATCH"], [Col, Uppercase<ColType>]>
		: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [Col]>

/** SQLT-11: the only type names a STRICT table allows. */
export type SqliteStrictTypeNames = "int" | "integer" | "real" | "text" | "blob" | "any"

/** SQLT-15: the names of the rowid pseudo-columns. */
export type SqliteRowidNames = "rowid" | "oid" | "_rowid_"
