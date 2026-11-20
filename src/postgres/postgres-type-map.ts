/** What `json` and `jsonb` columns hold (PGT-11, PGT-Q1 option A). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * PostgreSQL scalar type names (normalized identifiers / joined type words) → the TypeScript types the `postgres`
 * client returns with its default parsers (PGT-2…PGT-11, PGT-35). Inferred for the database chain when
 * `driver` is from **`postgresSqlDriver`** (`dbtyper/postgres`). dbtyper never changes the client's parsers (PGT-3):
 * `int8` and `numeric` are strings, except `int8` with `{ bigint: true }` (PGT-4), where the user's client parses to BigInt.
 * Aliases (`int4`, `int8`, `timestamptz`, `bool`, …) are folded by the parser before this lookup (TYPE-2, TYPE-3).
 */
export type PostgresTypeMap<Bigint extends boolean = false> = {
	// PGT-2
	smallint: number
	integer: number
	oid: number
	real: number
	float: number
	"double precision": number
	// PGT-3, PGT-4
	bigint: Bigint extends true ? bigint : string
	numeric: string
	decimal: string
	// PGT-5
	boolean: boolean
	text: string
	varchar: string
	"character varying": string
	char: string
	character: string
	bpchar: string
	name: string
	citext: string
	uuid: string
	// PGT-7
	date: Date
	timestamp: Date
	"timestamp with time zone": Date
	"timestamp without time zone": Date
	// PGT-8
	time: string
	"time with time zone": string
	"time without time zone": string
	interval: string
	// PGT-9
	bytea: Uint8Array
	// PGT-10
	inet: string
	cidr: string
	macaddr: string
	money: string
	xml: string
	tsvector: string
	tsquery: string
	bit: string
	"bit varying": string
	varbit: string
	// PGT-11
	json: JsonValue
	jsonb: JsonValue
}

/**
 * Parameter values per SQL type (PGT-17 input widenings): `bigint`/`numeric` accept `string | number | bigint`,
 * timestamp types accept `Date | string`, `json[b]` accept `JsonValue` (the result type already is).
 */
export type PostgresParamTypeMap<Bigint extends boolean = false> = Omit<
	PostgresTypeMap<Bigint>,
	| "bigint"
	| "numeric"
	| "decimal"
	| "date"
	| "timestamp"
	| "timestamptz"
	| "timestamp without time zone"
	| "timestamp with time zone"
> & {
	bigint: string | number | bigint
	numeric: string | number | bigint
	decimal: string | number | bigint
	date: Date | string
	timestamp: Date | string
	timestamptz: Date | string
	"timestamp without time zone": Date | string
	"timestamp with time zone": Date | string
}
