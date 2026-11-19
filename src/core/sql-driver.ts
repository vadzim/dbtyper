import type {
	ApplyAllowedQueryParams,
	LexerFeatures,
	LexerIndexedQueryParams,
	LexerNamedQueryParams,
} from "../lexer/sql-lexer.ts"
import type { DialectName, IsSingle } from "./dialect.ts"

/**
 * Positional PostgreSQL parameters (`$1`, `$2`, …), or a `:name` map — interpreted by drivers such as
 * `postgresSqlDriver`.
 */
export type SqlDriverParams = readonly unknown[] | Record<string, unknown>

/**
 * Type-level description of a driver. `dialect` decides how every migration and query of a chain is parsed
 * (DSEL-1, DSEL-3; src/core/dialect.ts); `syntax` lists the lexer features the driver binds (parameter styles,
 * dollar strings); `scalarTypes` maps SQL type names to TypeScript types.
 */
export type DriverConfig = {
	dialect: DialectName
	syntax: LexerFeatures
	scalarTypes: Record<string, unknown>
	/** Types accepted as parameter VALUES per SQL type, where they differ from the row types (SQLT-32). */
	paramTypes?: Record<string, unknown>
}

/** What `createDriver` accepts: a config that may lack `dialect`; `sqlMigrations` then rejects the driver (DSEL-8). */
export type DriverConfigDraft = Omit<DriverConfig, "dialect"> & { dialect?: DialectName }

/**
 * The driver config with only the parameter style the call's values allow. `syntax` is replaced, not intersected:
 * a driver whose syntax is only parameter styles (SQLite) would otherwise reduce the whole config to `never`.
 */
export type ParamsDriverConfig<Config extends DriverConfig, ParamsValues> = {
	dialect: Config["dialect"]
	scalarTypes: Config["scalarTypes"]
	syntax: ApplyAllowedQueryParams<
		Config["syntax"],
		ParamsValues extends null | undefined
			? never
			: ParamsValues extends readonly unknown[]
				? LexerIndexedQueryParams
				: LexerNamedQueryParams
	>
}

export type SqlDriver<_Config extends DriverConfigDraft> = {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>>
}

export type GetDriverConfig<S extends SqlDriver<DriverConfigDraft>> =
	S extends SqlDriver<infer Driver> ? (Driver extends DriverConfig ? Driver : never) : never

/** `"postgres" or "sqlite"`: the names of the dialects there are, for the messages below. */
type DialectNames = JoinOr<DialectName>

type JoinOr<U extends string, Last extends string = LastOf<U>> = [U] extends [never]
	? never
	: [Exclude<U, Last>] extends [never]
		? `"${Last}"`
		: `${JoinCommas<Exclude<U, Last>>} or "${Last}"`

type JoinCommas<U extends string, Last extends string = LastOf<U>> = [Exclude<U, Last>] extends [never]
	? `"${Last}"`
	: `${JoinCommas<Exclude<U, Last>>}, "${Last}"`

/** One member of a union of strings. */
type LastOf<U extends string> =
	UnionToIntersection<U extends unknown ? (x: U) => void : never> extends (x: infer L extends string) => void
		? L
		: never

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/**
 * DSEL-8: a driver whose config declares no single dialect is a compile error on `driver` at `sqlMigrations`.
 */
export type RequireDriverDialect<D> =
	D extends SqlDriver<infer Config>
		? Config extends { dialect: infer Dialect extends DialectName }
			? IsSingle<Dialect> extends true
				? {}
				: { driver: `error: the driver must declare one dialect, ${DialectNames} (DSEL-8)` }
			: {
					driver: `error: the driver declares no dialect; add dialect: ${DialectNames} to its config (DSEL-8)`
				}
		: {}

/**
 * Wraps query/stream functions as a {@link SqlDriver}. `Config` declares the driver's `dialect`
 * (`"postgres"` or `"sqlite"`, DSEL-8), its lexer `syntax` features and its `scalarTypes` map.
 */
export function createDriver<Config extends DriverConfigDraft>(methods: {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>>
}) {
	return methods as SqlDriver<Config>
}
