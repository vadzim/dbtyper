import type { SqlInteger, SqlText } from "../core/sql-type-shape.ts"

/**
 * SQLT-44…SQLT-51: the result of every SQLite function, as data (a row per function).
 * A row is the 5-tuple `[result, nulls, kind, arity, params]` of the grammar in function-catalog.ts. A name followed
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
	lower: ["text", "args", "scalar", null, [SqlText]]
	upper: ["text", "args", "scalar", null, [SqlText]]
	trim: ["text", "args", "scalar", null, [SqlText]]
	ltrim: ["text", "args", "scalar", null, [SqlText, SqlText]]
	rtrim: ["text", "args", "scalar", null, [SqlText, SqlText]]
	replace: ["text", "args", "scalar", null, [SqlText, SqlText, SqlText]]
	substr: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlInteger]]
	substring: ["text", "args", "scalar", null, [SqlText, SqlInteger, SqlInteger]]
	printf: ["text", "first", "scalar", null, null]
	format: ["text", "first", "scalar", null, null]
	quote: ["text", "args", "scalar", null, null]
	hex: ["text", "args", "scalar", null, null]
	char: ["text", "args", "scalar", null, null]
	concat: ["text", "non-null", "scalar", null, null]
	concat_ws: ["text", "first", "scalar", null, null]
	length: ["integer", "args", "scalar", null, [SqlText]]
	instr: ["integer", "args", "scalar", null, [SqlText, SqlText]]
	unicode: ["integer", "args", "scalar", null, [SqlText]]
	// SQLT-45 null handling
	coalesce: ["common", "all", "scalar", null, "peer"]
	ifnull: ["common", "all", "scalar", null, "peer"]
	nullif: ["arg", "null", "scalar", null, "peer"]
	iif: ["common-tail", "tail", "scalar", null, null]
	// SQLT-46 numbers
	abs: ["arg", "args", "scalar", null, null]
	round: ["real", "args", "scalar", null, null]
	sign: ["integer", "args", "scalar", null, null]
	random: ["integer", "args", "scalar", null, null]
	max: ["common", "args", "scalar", null, "peer"]
	min: ["common", "args", "scalar", null, "peer"]
	ceil: ["real", "args", "scalar", null, null]
	ceiling: ["real", "args", "scalar", null, null]
	floor: ["real", "args", "scalar", null, null]
	sqrt: ["real", "args", "scalar", null, null]
	pow: ["real", "args", "scalar", null, null]
	power: ["real", "args", "scalar", null, null]
	exp: ["real", "args", "scalar", null, null]
	ln: ["real", "args", "scalar", null, null]
	log: ["real", "args", "scalar", null, null]
	log10: ["real", "args", "scalar", null, null]
	log2: ["real", "args", "scalar", null, null]
	mod: ["real", "args", "scalar", null, null]
	pi: ["real", "args", "scalar", null, null]
	// SQLT-47 aggregates
	count: ["integer", "non-null", "aggregate", null, null]
	sum: ["sum", "null", "aggregate", null, null]
	total: ["real", "non-null", "aggregate", null, null]
	avg: ["real", "null", "aggregate", null, null]
	"max/1": ["arg", "null", "aggregate", null, "peer"]
	"min/1": ["arg", "null", "aggregate", null, "peer"]
	group_concat: ["text", "null", "aggregate", null, null]
	string_agg: ["text", "null", "aggregate", null, null]
	// SQLT-48 date and time
	date: ["text", "null", "scalar", null, null]
	time: ["text", "null", "scalar", null, null]
	datetime: ["text", "null", "scalar", null, null]
	strftime: ["text", "null", "scalar", null, null]
	timediff: ["text", "null", "scalar", null, null]
	julianday: ["real", "null", "scalar", null, null]
	unixepoch: ["integer", "null", "scalar", null, null]
	current_date: ["text", "non-null", "scalar", null, null]
	current_time: ["text", "non-null", "scalar", null, null]
	current_timestamp: ["text", "non-null", "scalar", null, null]
	// SQLT-49 JSON
	json: ["text", "args", "scalar", null, null]
	json_array: ["text", "args", "scalar", null, null]
	json_object: ["text", "args", "scalar", null, null]
	json_insert: ["text", "args", "scalar", null, null]
	json_replace: ["text", "args", "scalar", null, null]
	json_set: ["text", "args", "scalar", null, null]
	json_remove: ["text", "args", "scalar", null, null]
	json_patch: ["text", "args", "scalar", null, null]
	json_quote: ["text", "args", "scalar", null, null]
	json_group_array: ["text", "args", "aggregate", null, null]
	json_group_object: ["text", "args", "aggregate", null, null]
	json_array_length: ["integer", "args", "scalar", null, null]
	json_valid: ["integer", "args", "scalar", null, null]
	json_type: ["text", "args", "scalar", null, null]
	json_extract: ["any", "null", "scalar", null, null]
	// SQLT-50 other
	typeof: ["typeof", "non-null", "scalar", null, null]
	randomblob: ["blob", "args", "scalar", null, null]
	zeroblob: ["blob", "args", "scalar", null, null]
	last_insert_rowid: ["integer", "non-null", "scalar", null, null]
	changes: ["integer", "non-null", "scalar", null, null]
	total_changes: ["integer", "non-null", "scalar", null, null]
	likely: ["arg", "args", "scalar", null, null]
	unlikely: ["arg", "args", "scalar", null, null]
	likelihood: ["arg", "args", "scalar", null, null]
	// SQLT-51 window functions (aggregates with OVER are the rows above)
	row_number: ["integer", "non-null", "window", null, null]
	rank: ["integer", "non-null", "window", null, null]
	dense_rank: ["integer", "non-null", "window", null, null]
	ntile: ["integer", "non-null", "window", null, null]
	percent_rank: ["real", "non-null", "window", null, null]
	cume_dist: ["real", "non-null", "window", null, null]
	lag: ["arg", "lag", "window", null, null]
	lead: ["arg", "lag", "window", null, null]
	first_value: ["arg", "args", "window", null, null]
	last_value: ["arg", "args", "window", null, null]
	nth_value: ["arg", "null", "window", null, null]
	// SQLT-69…SQLT-72 table-valued functions: FROM items only (the "table" kind), columns in SqliteTableFunctions
	json_each: ["table", "non-null", "table", "jsonTable", [SqlText, SqlText]]
	json_tree: ["table", "non-null", "table", "jsonTable", [SqlText, SqlText]]
}

/**
 * SQLT-69, SQLT-70: the columns of `json_each` / `json_tree` (the hidden `json` and `root` are "Not yet"), as the
 * drivers return them: `json_key` an array index or an object label, `json_value` a number or text (an array or
 * object comes back as its JSON text, `true`/`false` as 1/0; SQLT-Q14), `json_type` the eight type names
 * (src/sqlite/sqlite-type-map.ts).
 */
type JsonTableColumns = {
	key: { type: "json_key"; arg: null; nullable: true }
	value: { type: "json_value"; arg: null; nullable: true }
	type: { type: "json_type"; arg: null; nullable: false }
	atom: { type: "json_value"; arg: null; nullable: true }
	id: SqlInteger
	parent: { type: "integer"; arg: null; nullable: true }
	fullkey: SqlText
	path: SqlText
}

/** The columns of each table-valued function (a "table" row of {@link SqliteFunctions}). */
export type SqliteTableFunctions = {
	json_each: JsonTableColumns
	json_tree: JsonTableColumns
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
