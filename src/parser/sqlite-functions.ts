import type { Nullable, SqlTypeShape } from "../core/sql-type-shape.ts"

/**
 * SQLT-44…SQLT-51: the result of every SQLite function, as data (a row per function, like `FunctionArgTypes`).
 * A row is `[result, nulls]` or `[result, nulls, "window"]` for a function that needs an OVER clause. A name followed
 * by `/N` is the row for exactly N arguments (`max/1` is the aggregate, `max` the scalar with two or more).
 *
 * `result`: a type name of the SQLite type map (`text`, `integer`, `real`, `blob`, `any`, `typeof`) or
 *   `arg` the type of the first argument, `common` the common type of all arguments, `common-tail` the common type of
 *   all but the first, `sum` integer over integer arguments, else real.
 * `nulls` (CORE-2): `args` nullable when any argument is; `non-null`; `null` always nullable; `all` nullable only
 *   when every argument is (`coalesce`, `ifnull`); `tail` nullable when any argument but the first is (`iif`);
 *   `first` nullable only when the first argument is (`concat_ws`, `format`, `printf`; PGT-28, SQLT-44);
 *   `lag` `lag`/`lead`: nullable unless a non-null default is given.
 */
export type SqliteFunctions = {
	// SQLT-44 text
	lower: ["text", "args"]
	upper: ["text", "args"]
	trim: ["text", "args"]
	ltrim: ["text", "args"]
	rtrim: ["text", "args"]
	replace: ["text", "args"]
	substr: ["text", "args"]
	substring: ["text", "args"]
	printf: ["text", "first"]
	format: ["text", "first"]
	quote: ["text", "args"]
	hex: ["text", "args"]
	char: ["text", "args"]
	concat: ["text", "non-null"]
	concat_ws: ["text", "first"]
	length: ["integer", "args"]
	instr: ["integer", "args"]
	unicode: ["integer", "args"]
	// SQLT-45 null handling
	coalesce: ["common", "all"]
	ifnull: ["common", "all"]
	nullif: ["arg", "null"]
	iif: ["common-tail", "tail"]
	// SQLT-46 numbers
	abs: ["arg", "args"]
	round: ["real", "args"]
	sign: ["integer", "args"]
	random: ["integer", "args"]
	max: ["common", "args"]
	min: ["common", "args"]
	ceil: ["real", "args"]
	ceiling: ["real", "args"]
	floor: ["real", "args"]
	sqrt: ["real", "args"]
	pow: ["real", "args"]
	power: ["real", "args"]
	exp: ["real", "args"]
	ln: ["real", "args"]
	log: ["real", "args"]
	log10: ["real", "args"]
	log2: ["real", "args"]
	mod: ["real", "args"]
	pi: ["real", "args"]
	// SQLT-47 aggregates
	count: ["integer", "non-null"]
	sum: ["sum", "null"]
	total: ["real", "non-null"]
	avg: ["real", "null"]
	"max/1": ["arg", "null"]
	"min/1": ["arg", "null"]
	group_concat: ["text", "null"]
	string_agg: ["text", "null"]
	// SQLT-48 date and time
	date: ["text", "null"]
	time: ["text", "null"]
	datetime: ["text", "null"]
	strftime: ["text", "null"]
	timediff: ["text", "null"]
	julianday: ["real", "null"]
	unixepoch: ["integer", "null"]
	current_date: ["text", "non-null"]
	current_time: ["text", "non-null"]
	current_timestamp: ["text", "non-null"]
	// SQLT-49 JSON
	json: ["text", "args"]
	json_array: ["text", "args"]
	json_object: ["text", "args"]
	json_insert: ["text", "args"]
	json_replace: ["text", "args"]
	json_set: ["text", "args"]
	json_remove: ["text", "args"]
	json_patch: ["text", "args"]
	json_quote: ["text", "args"]
	json_group_array: ["text", "args"]
	json_group_object: ["text", "args"]
	json_array_length: ["integer", "args"]
	json_valid: ["integer", "args"]
	json_type: ["text", "args"]
	json_extract: ["any", "null"]
	// SQLT-50 other
	typeof: ["typeof", "non-null"]
	randomblob: ["blob", "args"]
	zeroblob: ["blob", "args"]
	last_insert_rowid: ["integer", "non-null"]
	changes: ["integer", "non-null"]
	total_changes: ["integer", "non-null"]
	likely: ["arg", "args"]
	unlikely: ["arg", "args"]
	likelihood: ["arg", "args"]
	// SQLT-51 window functions (aggregates with OVER are the rows above)
	row_number: ["integer", "non-null", "window"]
	rank: ["integer", "non-null", "window"]
	dense_rank: ["integer", "non-null", "window"]
	ntile: ["integer", "non-null", "window"]
	percent_rank: ["real", "non-null", "window"]
	cume_dist: ["real", "non-null", "window"]
	lag: ["arg", "lag", "window"]
	lead: ["arg", "lag", "window"]
	first_value: ["arg", "args", "window"]
	last_value: ["arg", "args", "window"]
	nth_value: ["arg", "null", "window"]
}

/**
 * SQLT-35, SQLT-36: SQLite operators whose result is not that of the shared parser, as function rows (see
 * {@link SqliteFunctions}) over `[left, right]`: `||` is TEXT for any operands, `->` is TEXT (JSON) and nullable (SQLT-36: a missing path is NULL), `->>` any storage class.
 */
export type SqliteOperators = {
	"||": ["text", "args"]
	"->": ["text", "null"]
	"->>": ["any", "null"]
}

/**
 * SQLT-52: PostgreSQL functions that SQLite lacks, with the hint of the SQLite replacement ("" for none). Anything
 * else that is not in {@link SqliteFunctions} is the plain unknown-function error.
 */
export type SqlitePgOnlyFunctions = {
	now: "use datetime('now') or CURRENT_TIMESTAMP"
	gen_random_uuid: "use lower(hex(randomblob(16)))"
	uuid_generate_v4: "use lower(hex(randomblob(16)))"
	array_length: ""
	array_append: ""
	array_prepend: ""
	unnest: ""
	string_to_array: ""
	array_agg: "use json_group_array(x)"
	to_char: "use strftime(format, x)"
	to_timestamp: "use datetime(x, 'unixepoch')"
	date_trunc: "use date(x) or strftime(format, x)"
	initcap: ""
	left: "use substr(x, 1, n)"
	right: "use substr(x, -n)"
	greatest: "use the scalar max(a, b, …)"
	least: "use the scalar min(a, b, …)"
	random_normal: ""
	jsonb_build_object: "use json_object(…)"
	json_build_object: "use json_object(…)"
	json_agg: "use json_group_array(x)"
	jsonb_agg: "use json_group_array(x)"
	char_length: "use length(x)"
	character_length: "use length(x)"
	md5: ""
	btrim: "use trim(x, chars)"
	strpos: "use instr(x, y)"
	lpad: "use printf('%5s', x)"
	rpad: "use printf('%-5s', x)"
	repeat: "use replace(hex(zeroblob(n)), '00', x)"
	reverse: ""
	starts_with: "use x LIKE y || '%'"
	extract: "use strftime(format, x)"
	age: ""
	generate_series: ""
	bool_and: "use min(x)"
	bool_or: "use max(x)"
	every: "use min(x)"
}

type FnKey<L extends string, N extends number> = `${L}/${N}` extends keyof SqliteFunctions
	? `${L}/${N}`
	: L extends keyof SqliteFunctions
		? L
		: never

/** Whether `L` is a SQLite function (with `N` arguments). */
export type IsSqliteFunction<L extends string> = L extends keyof SqliteFunctions
	? true
	: `${L}/1` extends keyof SqliteFunctions
		? true
		: false

/** The row of a SQLite function name for N arguments, or `never`. */
export type SqliteFunctionRow<L extends string, N extends number> =
	FnKey<L, N> extends infer K extends keyof SqliteFunctions ? SqliteFunctions[K] : never

type Numeric = "integer" | "real" | "numeric" | "boolean" | "bigint"

type Common2<A extends string, B extends string> = A extends B
	? A
	: [A | B] extends [Numeric]
		? "real" extends A | B
			? "real"
			: "numeric" extends A | B
				? "numeric"
				: "integer"
		: "any"

/** Common type of argument types: null literals are ignored; equal types stay, numbers widen, otherwise `any`. */
type CommonType<Args extends readonly SqlTypeShape[], Acc extends string = never> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["type"] extends "null"
		? CommonType<T, Acc>
		: [Acc] extends [never]
			? CommonType<T, H["type"]>
			: CommonType<T, Common2<Acc, H["type"]>>
	: [Acc] extends [never]
		? "null"
		: Acc

export type Shape<T extends string> = { type: T; arg: null; nullable: false }

export type Tail<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	unknown,
	...infer T extends readonly SqlTypeShape[],
]
	? T
	: readonly []

type ResultShape<R extends string, Args extends readonly SqlTypeShape[]> = R extends "arg"
	? Args extends readonly [infer A extends SqlTypeShape, ...unknown[]]
		? { type: A["type"]; arg: A["arg"]; nullable: false }
		: Shape<"any">
	: R extends "common"
		? Shape<CommonType<Args>>
		: R extends "common-tail"
			? Shape<CommonType<Tail<Args>>>
			: R extends "sum"
				? Args extends readonly [{ type: "integer" | "boolean" | "bigint" }, ...unknown[]]
					? Shape<"integer">
					: Shape<"real">
				: Shape<R>

export type AnyNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? true
		: AnyNullable<T>
	: false

export type AllNullable<Args extends readonly SqlTypeShape[]> = Args extends readonly [
	infer H extends SqlTypeShape,
	...infer T extends readonly SqlTypeShape[],
]
	? H["nullable"] extends true
		? AllNullable<T>
		: false
	: true

/** CORE-2 for one row: is the result nullable, given the argument types. */
export type IsResultNullable<N extends string, Args extends readonly SqlTypeShape[]> = N extends "non-null"
	? false
	: N extends "null"
		? true
		: N extends "all"
			? Args extends readonly []
				? false
				: AllNullable<Args>
			: N extends "tail"
				? AnyNullable<Tail<Args>>
				: N extends "first"
					? Args extends readonly [infer F extends SqlTypeShape, ...unknown[]]
						? F["nullable"]
						: false
					: N extends "lag"
						? Args extends readonly [SqlTypeShape, SqlTypeShape, infer D extends SqlTypeShape]
							? D["nullable"] extends true
								? true
								: AnyNullable<Args>
							: true
						: AnyNullable<Args>

/** Result of a SQLite function row for resolved argument types. */
export type SqliteRowResult<Row, Args extends readonly SqlTypeShape[]> = Row extends readonly [
	infer R extends string,
	infer N extends string,
	...unknown[],
]
	? ResultShape<R, Args> extends infer S extends SqlTypeShape
		? IsResultNullable<N, Args> extends true
			? Nullable<S>
			: S
		: never
	: never

/** Whether the row needs an OVER clause. */
export type IsWindowOnlyRow<Row> = Row extends readonly [string, string, "window"] ? true : false
