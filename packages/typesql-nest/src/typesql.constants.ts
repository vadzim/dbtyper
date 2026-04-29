/** Resolved once in {@link TypesqlModule}; inject for lifecycle or advanced wiring. */
export const TYPESQL_ROOT_OPTIONS = Symbol("TYPESQL_ROOT_OPTIONS")

/** The compiled logical database from `compile()`. */
export const TYPESQL_COMPILED = Symbol("TYPESQL_COMPILED")

/** `compiled.connect(driver)` — inject this for `query()` / `stream()`. */
export const TYPESQL_CONNECTED = Symbol("TYPESQL_CONNECTED")
