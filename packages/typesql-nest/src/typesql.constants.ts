/** Resolved once in {@link TypesqlModule}; inject for lifecycle or advanced wiring. */
export const TYPESQL_ROOT_OPTIONS = Symbol("TYPESQL_ROOT_OPTIONS")

/** `database` — inject this for `query()` / `stream()`. */
export const TYPESQL_DATABASE = Symbol("TYPESQL_DATABASE")
