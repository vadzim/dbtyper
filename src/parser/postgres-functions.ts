import type { Nullable, SqlArray, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { IsResultNullable, Shape } from "./sqlite-functions.ts"

/**
 * PGT-27…PGT-33: the result of every PostgreSQL function, as data (a row per function, like `SqliteFunctions`).
 * A row is `[result, nulls]`, `[result, nulls, "aggregate"]` (also valid before `OVER`, FILTER) or
 * `[result, nulls, "window"]` (needs an OVER clause).
 *
 * `result`: a type name of the PostgreSQL type map, or
 *   `arg` the type of the first argument, `arg2` the type of the second, `common` the common numeric/other type of all
 *   arguments, `first-value` the type of the first argument that is not a NULL literal, `sum`/`avg` per argument type
 *   (PGT-27), `array-of-arg` an array of the first argument's type, `text[]` an array of text.
 * `nulls` (CORE-2): the names of {@link IsResultNullable}: `args` nullable when any argument is; `non-null`; `null`
 *   always nullable (aggregates over an empty set); `all` nullable only when every argument is (`greatest`,
 *   `coalesce`); `lag` for `lag`/`lead`.
 */
export type PostgresFunctions = {
	// PGT-27 aggregates
	count: ["bigint", "non-null", "aggregate"]
	sum: ["sum", "null", "aggregate"]
	avg: ["avg", "null", "aggregate"]
	min: ["arg", "null", "aggregate"]
	max: ["arg", "null", "aggregate"]
	bool_and: ["boolean", "null", "aggregate"]
	bool_or: ["boolean", "null", "aggregate"]
	every: ["boolean", "null", "aggregate"]
	string_agg: ["text", "null", "aggregate"]
	array_agg: ["array-of-arg", "null", "aggregate"]
	json_agg: ["json", "null", "aggregate"]
	jsonb_agg: ["jsonb", "null", "aggregate"]
	json_object_agg: ["json", "null", "aggregate"]
	jsonb_object_agg: ["jsonb", "null", "aggregate"]
	// PGT-28 text
	length: ["integer", "args"]
	char_length: ["integer", "args"]
	octet_length: ["integer", "args"]
	position: ["integer", "args"]
	strpos: ["integer", "args"]
	lower: ["text", "args"]
	upper: ["text", "args"]
	initcap: ["text", "args"]
	trim: ["text", "args"]
	btrim: ["text", "args"]
	ltrim: ["text", "args"]
	rtrim: ["text", "args"]
	substr: ["text", "args"]
	substring: ["text", "args"]
	replace: ["text", "args"]
	left: ["text", "args"]
	right: ["text", "args"]
	lpad: ["text", "args"]
	rpad: ["text", "args"]
	split_part: ["text", "args"]
	repeat: ["text", "args"]
	reverse: ["text", "args"]
	concat: ["text", "non-null"]
	concat_ws: ["text", "first"]
	format: ["text", "first"]
	md5: ["text", "args"]
	to_char: ["text", "args"]
	regexp_replace: ["text", "args"]
	// PGT-29 math
	abs: ["arg", "args"]
	ceil: ["arg", "args"]
	floor: ["arg", "args"]
	round: ["arg", "args"]
	trunc: ["arg", "args"]
	mod: ["arg", "args"]
	power: ["double precision", "args"]
	sqrt: ["double precision", "args"]
	random: ["double precision", "non-null"]
	greatest: ["common", "all"]
	least: ["common", "all"]
	// FN-8
	coalesce: ["first-value", "all"]
	// PGT-30 date and time (FN-10)
	now: ["timestamp with time zone", "non-null"]
	current_timestamp: ["timestamp with time zone", "non-null"]
	clock_timestamp: ["timestamp with time zone", "non-null"]
	statement_timestamp: ["timestamp with time zone", "non-null"]
	transaction_timestamp: ["timestamp with time zone", "non-null"]
	current_date: ["date", "non-null"]
	current_time: ["time with time zone", "non-null"]
	date_trunc: ["arg2", "args"]
	extract: ["numeric", "args"]
	date_part: ["double precision", "args"]
	age: ["interval", "args"]
	to_timestamp: ["timestamp with time zone", "args"]
	make_date: ["date", "args"]
	make_interval: ["interval", "args"]
	gen_random_uuid: ["uuid", "non-null"]
	uuid_generate_v4: ["uuid", "non-null"]
	// PGT-31 JSON
	to_json: ["json", "args"]
	to_jsonb: ["jsonb", "args"]
	json_build_object: ["json", "non-null"]
	jsonb_build_object: ["jsonb", "non-null"]
	json_build_array: ["json", "non-null"]
	jsonb_build_array: ["jsonb", "non-null"]
	jsonb_set: ["jsonb", "args"]
	jsonb_strip_nulls: ["jsonb", "args"]
	json_array_length: ["integer", "args"]
	jsonb_array_length: ["integer", "args"]
	json_typeof: ["text", "args"]
	jsonb_typeof: ["text", "args"]
	jsonb_extract_path_text: ["text", "null"]
	// PGT-32 other (array_length, array_append, array_prepend, unnest: FN-19…FN-21, kept in the expression parser)
	cardinality: ["integer", "args"]
	array_position: ["integer", "null"]
	array_cat: ["arg", "args"]
	array_remove: ["arg", "args"]
	string_to_array: ["text[]", "args"]
	array_to_string: ["text", "args"]
	generate_series: ["arg", "args"]
	// PGT-33 window functions (aggregates with OVER are the rows above)
	row_number: ["bigint", "non-null", "window"]
	rank: ["bigint", "non-null", "window"]
	dense_rank: ["bigint", "non-null", "window"]
	ntile: ["integer", "non-null", "window"]
	percent_rank: ["double precision", "non-null", "window"]
	cume_dist: ["double precision", "non-null", "window"]
	lag: ["arg", "lag", "window"]
	lead: ["arg", "lag", "window"]
	first_value: ["arg", "args", "window"]
	last_value: ["arg", "args", "window"]
	nth_value: ["arg", "null", "window"]
}

/**
 * Arity rules that are compile errors (FN-5, FN-7…FN-10, FN-12, FN-24): `[min, max, error key]`, `-1` = no limit.
 * A name not in this table accepts any number of arguments.
 */
export type PostgresFunctionArity = {
	lower: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	upper: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	min: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	max: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	coalesce: [1, -1, "COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	sum: [1, -1, "SUM_REQUIRES_AN_ARGUMENT"]
	avg: [1, -1, "SUM_REQUIRES_AN_ARGUMENT"]
	now: [0, 0, "NOW_TAKES_NO_ARGUMENTS"]
	gen_random_uuid: [0, 0, "THIS_FUNCTION_TAKES_NO_ARGUMENTS"]
	uuid_generate_v4: [0, 0, "THIS_FUNCTION_TAKES_NO_ARGUMENTS"]
	row_number: [0, 0, "ROW_NUMBER_TAKES_NO_ARGUMENTS"]
	rank: [0, 0, "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"]
	dense_rank: [0, 0, "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"]
	lag: [1, -1, "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"]
	lead: [1, -1, "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"]
}

/** PGT-34: SQLite functions that PostgreSQL lacks, with the hint of the PostgreSQL replacement ("" for none). */
export type PostgresSqliteOnlyFunctions = {
	ifnull: "use coalesce(a, b)"
	iif: "use CASE WHEN … THEN … ELSE … END"
	group_concat: "use string_agg(x, ',')"
	json_group_array: "use json_agg(x)"
	json_group_object: "use json_object_agg(k, v)"
	datetime: "use now() or to_char(x, format)"
	date: "use x::date"
	time: "use x::time"
	strftime: "use to_char(x, format)"
	julianday: ""
	unixepoch: "use extract(epoch from x)"
	instr: "use strpos(x, y)"
	printf: "use format(…)"
	hex: "use encode(x, 'hex')"
	typeof: "use pg_typeof(x)"
	randomblob: "use gen_random_bytes(n)"
	zeroblob: ""
	last_insert_rowid: "use INSERT … RETURNING"
	changes: ""
	total_changes: ""
	total: "use sum(x)"
	sign: ""
	likely: ""
	unlikely: ""
	json_extract: "use the -> and ->> operators"
	json_array: "use json_build_array(…)"
	json_object: "use json_build_object(…)"
	pi: ""
	log2: ""
}

/** The widest numeric type among the two (PostgreSQL's numeric hierarchy); other types keep the first. */
type PgCommon2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [PgNumeric]
		? "double precision" extends A | B
			? "double precision"
			: "real" extends A | B
				? "real"
				: "numeric" extends A | B
					? "numeric"
					: "bigint" extends A | B
						? "bigint"
						: "integer"
		: A

type PgNumeric = "smallint" | "integer" | "bigint" | "numeric" | "real" | "double precision"

/** Common type of `greatest`/`least` arguments: NULL literals are ignored, numbers widen, else the first type. */
type PgCommonType<Args extends readonly SqlTypeShape[], Acc extends string = never> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? PgCommonType<T, Acc>
		: [Acc] extends [never]
			? PgCommonType<T, H["type"]>
			: PgCommonType<T, PgCommon2<Acc, H["type"]>>
	: [Acc] extends [never]
		? "null"
		: Acc

type FirstValue<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? FirstValue<T>
		: H
	: { type: "null"; arg: null; nullable: true }

/** PGT-27: `sum` over smallint/integer is bigint, over bigint/numeric numeric, over floats the same type. */
type PgSumType<T extends string> = T extends "smallint" | "integer"
	? "bigint"
	: T extends "real" | "double precision"
		? T
		: "numeric"

/** PGT-27: `avg` over integers and numeric is numeric, over floats double precision. */
type PgAvgType<T extends string> = T extends "real" | "double precision" ? "double precision" : "numeric"

type PgResultShape<R extends string, Args extends readonly SqlTypeShape[]> = R extends "arg"
	? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
		? { type: A["type"]; arg: A["arg"]; nullable: false }
		: Shape<"unknown">
	: R extends "arg2"
		? Args extends readonly [unknown, infer A extends SqlTypeShape, ...unknown[]]
			? { type: A["type"]; arg: A["arg"]; nullable: false }
			: Shape<"unknown">
		: R extends "common"
			? Shape<PgCommonType<Args>>
			: R extends "first-value"
				? FirstValue<Args> extends infer F extends SqlTypeShape
					? { type: F["type"]; arg: F["arg"]; nullable: false }
					: never
				: R extends "sum"
					? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
						? Shape<PgSumType<A["type"]>>
						: Shape<"numeric">
					: R extends "avg"
						? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
							? Shape<PgAvgType<A["type"]>>
							: Shape<"numeric">
						: R extends "array-of-arg"
							? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
								? SqlArray<{ type: A["type"]; arg: A["arg"]; nullable: false }>
								: Shape<"unknown">
							: R extends "text[]"
								? SqlArray<Shape<"text">>
								: Shape<R>

/** Whether `L` is a PostgreSQL catalog function. */
export type IsPostgresFunction<L extends string> = L extends keyof PostgresFunctions ? true : false

/** Result of a PostgreSQL function row for resolved argument types (CORE-2 per the row). */
export type PostgresRowResult<Row, Args extends readonly SqlTypeShape[]> = Row extends readonly [
	infer R extends string,
	infer N extends string,
	...unknown[],
]
	? PgResultShape<R, Args> extends infer S extends SqlTypeShape
		? IsResultNullable<N, Args> extends true
			? Nullable<S>
			: S
		: never
	: never

/** Whether the row may be used before OVER (an aggregate or a window function). */
export type IsWindowCapableRow<Row> = Row extends readonly [string, string, "aggregate" | "window"] ? true : false
