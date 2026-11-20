import type { SqlInteger, SqlText } from "../core/sql-type-shape.ts"

/**
 * PGT-27…PGT-33: the result of every PostgreSQL function, as data (a row per function, like `SqliteFunctions`).
 * A row is the 5-tuple `[result, nulls, kind, arity, params]` of the grammar in function-catalog.ts (`kind`
 * "aggregate" is also valid before `OVER`, FILTER; "window" needs an OVER clause).
 *
 * `result`: a type name of the PostgreSQL type map, or
 *   `arg` the type of the first argument, `arg2` the type of the second, `common` the common numeric/other type of all
 *   arguments, `first-value` the type of the first argument that is not a NULL literal, `sum`/`avg` per argument type
 *   (PGT-27), `array-of-arg` an array of the first argument's type, `text[]` an array of text, `numeric-or-double`
 *   `numeric` when an argument is `numeric`, else `double precision` (`power`, `sqrt`, `sign`; #153).
 * `nulls` (CORE-2): the names of {@link IsResultNullable}: `args` nullable when any argument is; `non-null`; `null`
 *   always nullable (aggregates over an empty set); `all` nullable only when every argument is (`greatest`,
 *   `coalesce`); `lag` for `lag`/`lead`.
 */
export type PostgresFunctions = {
	// PGT-27 aggregates
	count: ["bigint", "non-null", "aggregate", null, null]
	sum: ["sum", "null", "aggregate", "sum", null]
	avg: ["avg", "null", "aggregate", "sum", null]
	min: ["arg", "null", "aggregate", "atLeastOne", "peer"]
	max: ["arg", "null", "aggregate", "atLeastOne", "peer"]
	bool_and: ["boolean", "null", "aggregate", null, null]
	bool_or: ["boolean", "null", "aggregate", null, null]
	every: ["boolean", "null", "aggregate", null, null]
	string_agg: ["text", "null", "aggregate", null, null]
	array_agg: ["array-of-arg", "null", "aggregate", null, null]
	json_agg: ["json", "null", "aggregate", null, null]
	jsonb_agg: ["jsonb", "null", "aggregate", null, null]
	json_object_agg: ["json", "null", "aggregate", null, null]
	jsonb_object_agg: ["jsonb", "null", "aggregate", null, null]
	// PGT-28 text
	length: ["integer", "args", "scalar", null, [SqlText]]
	char_length: ["integer", "args", "scalar", null, [SqlText]]
	octet_length: ["integer", "args", "scalar", null, null]
	position: ["integer", "args", "scalar", null, null]
	strpos: ["integer", "args", "scalar", null, [SqlText, SqlText]]
	lower: ["text", "args", "scalar", "atLeastOne", [SqlText]]
	upper: ["text", "args", "scalar", "atLeastOne", [SqlText]]
	initcap: ["text", "args", "scalar", null, [SqlText]]
	trim: ["text", "args", "scalar", null, [SqlText]]
	btrim: ["text", "args", "scalar", null, [SqlText, SqlText]]
	ltrim: ["text", "args", "scalar", null, [SqlText, SqlText]]
	rtrim: ["text", "args", "scalar", null, [SqlText, SqlText]]
	substr: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlInteger]]
	substring: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlInteger]]
	replace: ["text", "args", "scalar", null, [SqlText, SqlText, SqlText]]
	left: ["text", "args", "scalar", null, [SqlText, SqlInteger]]
	right: ["text", "args", "scalar", null, [SqlText, SqlInteger]]
	lpad: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlText]]
	rpad: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlText]]
	split_part: ["text", "args", "scalar", null, null]
	repeat: ["text", "args", "scalar", null, [SqlText, SqlInteger]]
	reverse: ["text", "args", "scalar", null, [SqlText]]
	concat: ["text", "non-null", "scalar", null, null]
	concat_ws: ["text", "first", "scalar", null, null]
	format: ["text", "first", "scalar", null, null]
	md5: ["text", "args", "scalar", null, [SqlText]]
	encode: ["text", "args", "scalar", null, null]
	decode: ["bytea", "args", "scalar", null, [SqlText, SqlText]]
	gen_random_bytes: ["bytea", "args", "scalar", null, [SqlInteger]]
	pg_typeof: ["regtype", "non-null", "scalar", null, null]
	to_char: ["text", "args", "scalar", null, null]
	regexp_replace: ["text", "args", "scalar", null, null]
	// PGT-29 math
	abs: ["arg", "args", "scalar", null, null]
	ceil: ["arg", "args", "scalar", null, null]
	floor: ["arg", "args", "scalar", null, null]
	round: ["arg", "args", "scalar", null, null]
	trunc: ["arg", "args", "scalar", null, null]
	mod: ["arg", "args", "scalar", null, null]
	power: ["numeric-or-double", "args", "scalar", null, null]
	sqrt: ["numeric-or-double", "args", "scalar", null, null]
	sign: ["numeric-or-double", "args", "scalar", null, null]
	pi: ["double precision", "non-null", "scalar", "noArgs", null]
	random: ["double precision", "non-null", "scalar", null, null]
	greatest: ["common", "all", "scalar", null, "peer"]
	least: ["common", "all", "scalar", null, "peer"]
	// FN-8
	coalesce: ["first-value", "all", "scalar", "coalesce", "peer"]
	nullif: ["arg", "null", "scalar", null, "peer"]
	// PGT-30 date and time (FN-10)
	now: ["timestamp with time zone", "non-null", "scalar", "now", null]
	current_timestamp: ["timestamp with time zone", "non-null", "scalar", null, null]
	clock_timestamp: ["timestamp with time zone", "non-null", "scalar", null, null]
	statement_timestamp: ["timestamp with time zone", "non-null", "scalar", null, null]
	transaction_timestamp: ["timestamp with time zone", "non-null", "scalar", null, null]
	current_date: ["date", "non-null", "scalar", null, null]
	current_time: ["time with time zone", "non-null", "scalar", null, null]
	date_trunc: ["arg2", "args", "scalar", null, null]
	extract: ["numeric", "args", "scalar", null, null]
	date_part: ["double precision", "args", "scalar", null, null]
	age: ["interval", "args", "scalar", null, null]
	to_timestamp: ["timestamp with time zone", "args", "scalar", null, null]
	make_date: ["date", "args", "scalar", null, null]
	make_interval: ["interval", "args", "scalar", null, null]
	gen_random_uuid: ["uuid", "non-null", "scalar", "noArgs", null]
	uuid_generate_v4: ["uuid", "non-null", "scalar", "noArgs", null]
	// PGT-31 JSON
	to_json: ["json", "args", "scalar", null, null]
	to_jsonb: ["jsonb", "args", "scalar", null, null]
	json_build_object: ["json", "non-null", "scalar", null, null]
	jsonb_build_object: ["jsonb", "non-null", "scalar", null, null]
	json_build_array: ["json", "non-null", "scalar", null, null]
	jsonb_build_array: ["jsonb", "non-null", "scalar", null, null]
	jsonb_set: ["jsonb", "args", "scalar", null, null]
	jsonb_strip_nulls: ["jsonb", "args", "scalar", null, null]
	json_array_length: ["integer", "args", "scalar", null, null]
	jsonb_array_length: ["integer", "args", "scalar", null, null]
	json_typeof: ["text", "args", "scalar", null, null]
	jsonb_typeof: ["text", "args", "scalar", null, null]
	jsonb_extract_path_text: ["text", "null", "scalar", null, null]
	// PGT-32 other (array_length, array_append, array_prepend, unnest: FN-19…FN-21, kept in the expression parser)
	cardinality: ["integer", "args", "scalar", null, null]
	array_position: ["integer", "null", "scalar", null, null]
	array_cat: ["arg", "args", "scalar", null, null]
	array_remove: ["arg", "args", "scalar", null, null]
	string_to_array: ["text[]", "args", "scalar", null, null]
	array_to_string: ["text", "args", "scalar", null, null]
	generate_series: ["arg", "args", "scalar", null, null]
	// FN-19…FN-21: own errors in the result and the arity
	array_length: ["array-length", "args", "scalar", "arrayLength", null]
	array_append: ["array-append", "args", "scalar", "arrayAppend", null]
	array_prepend: ["array-prepend", "args", "scalar", "arrayPrepend", null]
	unnest: ["unnest", "args", "scalar", "unnest", null]
	// PGT-33 window functions (aggregates with OVER are the rows above)
	row_number: ["bigint", "non-null", "window", "rowNumber", null]
	rank: ["bigint", "non-null", "window", "rankDenseRank", null]
	dense_rank: ["bigint", "non-null", "window", "rankDenseRank", null]
	ntile: ["integer", "non-null", "window", null, null]
	percent_rank: ["double precision", "non-null", "window", null, null]
	cume_dist: ["double precision", "non-null", "window", null, null]
	lag: ["arg", "lag", "window", "lagLead", null]
	lead: ["arg", "lag", "window", "lagLead", null]
	first_value: ["arg", "args", "window", null, null]
	last_value: ["arg", "args", "window", null, null]
	nth_value: ["arg", "null", "window", null, null]
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
	typeof: "use CAST(pg_typeof(x) AS text)"
	randomblob: "use gen_random_bytes(n)"
	zeroblob: ""
	last_insert_rowid: "use INSERT … RETURNING"
	changes: ""
	total_changes: ""
	total: "use sum(x)"
	likely: ""
	unlikely: ""
	json_extract: "use the -> and ->> operators"
	json_array: "use json_build_array(…)"
	json_object: "use json_build_object(…)"
	log2: ""
}
