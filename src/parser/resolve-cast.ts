import type { DbDialectOnlyError, DialectFact, PgOnlyTypeNames, SqliteTypeKey } from "../core/dialect.ts"
import type {
	SqlBigint,
	SqlBoolean,
	SqlInteger,
	SqlNull,
	SqlNumeric,
	SqlText,
	SqlType,
	SqlTypeShape,
	SqlUuid,
} from "../core/sql-type-shape.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { EnumCastCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { ResolveUserType } from "./parse-sql-type-words.ts"

export type SqlCastTypeNorm<P extends readonly string[]> = P extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? Lowercase<H>
		: H extends `${string}.`
			? `${Lowercase<H>}${SqlCastTypeNorm<T>}` // `schema.type`: the dot joins without a space
			: `${Lowercase<H>} ${SqlCastTypeNorm<T>}`
	: string

/** SQLT-12: in a SQLite chain `CAST(x AS t)` gets the type of a column declared `t` (its affinity key, SQLT-6…SQLT-8). */
export type CastTypeParts<Db, Parts extends readonly string[]> =
	DialectFact<Db, "declaredTypes"> extends "affinity" ? readonly [SqliteTypeKey<SqlCastTypeNorm<Parts>>] : Parts

/** SQLT-53: `CAST(x AS jsonb)` in a SQLite chain names the PostgreSQL-only type. */
export type CastPgOnlyTypeError<Db, Parts extends readonly string[]> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? SqlCastTypeNorm<Parts> extends infer T extends keyof PgOnlyTypeNames
			? DbDialectOnlyError<Db, PgOnlyTypeNames[T]>
			: null
		: null

/** PGT-14: a string literal cast to an enum must be one of its labels; `Cast` otherwise. */
export type WithCastLabelCheck<Db, Cast, Ast> = Cast extends SqlTypeShape
	? WithEnumCheck<EnumCastCheck<Db, Cast, Ast>, Cast>
	: Cast

/** `CAST` / `::` result typing for SqlTypeShape (PostgreSQL-oriented compatibility checks). */
/** SQLT-6: in a chain whose type names only decide an affinity (SQLite) a CAST gives the type of that affinity, from any value. */
export type ResolveCastForDialect<Db, Ev extends SqlTypeShape, N extends string> =
	DialectFact<Db, "declaredTypes"> extends "affinity"
		? Ev["type"] extends "null"
			? SqlNull
			: SqlType<SqliteTypeKey<N>>
		: N extends `${infer Sch}.${infer Tn}`
			? CastToNamedType<Db, Ev, Sch, Tn>
			: CastToNamedType<Db, Ev, DefaultSchemaOf<Db>, N>

/** PGT-13, PGT-22: a cast to a type name: an enum or a domain of the chain, else a built-in type. */
type CastToNamedType<Db, Ev extends SqlTypeShape, Schema extends string, N extends string> =
	ResolveUserType<Db, Schema, SqlType<N>> extends [infer U extends SqlTypeShape, boolean]
		? U["type"] extends N
			? ResolveCastFromShape<Ev, N>
			: U
		: ResolveCastFromShape<Ev, N>

type DefaultSchemaOf<Db> = Db extends { defaultSchema: infer D extends string } ? D : ""

export type ResolveCastFromShape<Ev extends SqlTypeShape, N extends string> = Ev["type"] extends "null"
	? SqlNull
	: N extends "text" | "varchar" | "character varying" | "char"
		? SqlText
		: N extends "integer" | "int" | "int4" | "smallint" | "int2" | "serial" | "smallserial"
			? Ev["type"] extends "boolean"
				? FormatError<Errors["CANNOT_CAST_BOOLEAN_TO_INTEGER"], []>
				: SqlInteger
			: N extends "bigint" | "int8" | "bigserial"
				? Ev["type"] extends "boolean"
					? FormatError<Errors["CANNOT_CAST_BOOLEAN_TO_INTEGER"], []>
					: SqlBigint
				: N extends "boolean" | "bool"
					? Ev["type"] extends "integer" | "bigint" | "numeric"
						? FormatError<Errors["CANNOT_CAST_INTEGER_TO_BOOLEAN"], []>
						: SqlBoolean
					: N extends "uuid"
						? SqlUuid
						: N extends "bytea"
							? SqlType<"bytea">
							: N extends
										| "timestamp"
										| "timestamp with time zone"
										| "timestamptz"
										| "date"
										| "time"
										| "time with time zone"
										| "timetz"
										| "interval"
								? SqlType<N>
								: N extends "inet" | "cidr"
									? SqlType<N>
									: N extends "tsvector" | "tsquery"
										? SqlType<N>
										: N extends "real" | "float4"
											? SqlType<"real">
											: N extends "double precision" | "float8"
												? SqlType<"double precision">
												: N extends "numeric" | "decimal"
													? SqlNumeric
													: SqlType<N>
