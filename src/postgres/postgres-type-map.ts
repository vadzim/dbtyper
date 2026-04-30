/**
 * PostgreSQL-oriented SQL scalar spellings (normalized identifiers / joined type words) → TypeScript types.
 * Inferred for `SqlDatabase` / `sqlDatabase` when `driver` is from **`postgresSqlDriver`** (`dbtyper/postgres`).
 */
export type PostgresTypeMap = {
	uuid: string
	text: string
	integer: number
	int: number
	bigint: bigint
	smallint: number
	boolean: boolean
	bool: boolean
	numeric: string
	decimal: string
	real: number
	float: number
	"double precision": number
	json: unknown
	jsonb: unknown
	date: string
	timestamp: Date
	"timestamp with time zone": Date
	"timestamp without time zone": Date
	"time with time zone": string
	"time without time zone": string
	"character varying": string
	varchar: string
	char: string
}
