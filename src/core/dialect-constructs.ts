/**
 * The data of one-dialect constructs (DSEL-5, DSEL-6): which construct belongs to which engine, how a message names
 * it, and the keyword phrases that signal one. Rows only; the rules that read them are in dialect.ts.
 */

/**
 * Constructs that exist in one engine only (DSEL-5, DSEL-6). `name` is how the message names the construct, `hint`
 * the suggested replacement in the chain's own dialect ("" for none); `<next>` in a hint is replaced by the next
 * word of the SQL, upper-cased (`id::text` → `Use CAST(x AS TEXT)`).
 * The full PostgreSQL-only list is SQLT-53; rows are added by the issues that own them.
 */
export type DialectOnlyConstructs = {
	"pg-cast": { only: "postgres"; name: "`::` cast"; hint: "Use CAST(x AS <next>)" }
	"pg-positional-param": { only: "postgres"; name: "`$n` positional parameter"; hint: "Use ? or ?NNN" }
	"pg-dollar-string": { only: "postgres"; name: "Dollar-quoted string"; hint: "Use a single-quoted string" }
	"sqlite-backtick-ident": {
		only: "sqlite"
		name: "Backtick-quoted identifier"
		hint: 'Use a double-quoted identifier ("name")'
	}
	"sqlite-insert-or-replace": { only: "sqlite"; name: "INSERT OR REPLACE"; hint: "Use ON CONFLICT … DO UPDATE" }
	"sqlite-insert-or-ignore": { only: "sqlite"; name: "INSERT OR IGNORE"; hint: "Use ON CONFLICT DO NOTHING" }
	"sqlite-insert-or": { only: "sqlite"; name: "INSERT OR <conflict action>"; hint: "Use ON CONFLICT" }
	"sqlite-replace-into": { only: "sqlite"; name: "REPLACE INTO"; hint: "Use INSERT … ON CONFLICT … DO UPDATE" }
	"pg-serial": { only: "postgres"; name: "SERIAL type"; hint: "Use INTEGER PRIMARY KEY" }
	"pg-alter-column": {
		only: "postgres"
		name: "ALTER COLUMN"
		hint: "Rebuild the table (create, copy, drop, rename)"
	}
	"pg-add-constraint": { only: "postgres"; name: "ADD CONSTRAINT"; hint: "Declare it in CREATE TABLE" }
	// SQLT-53 (#76)
	"pg-array-ctor": { only: "postgres"; name: "`ARRAY[…]`"; hint: "Use json_array(…)" }
	"pg-array-type": { only: "postgres"; name: "Array type `T[]`"; hint: "Use a JSON TEXT column" }
	"pg-any-all-some": {
		only: "postgres"
		name: "`ANY`/`ALL`/`SOME` comparison"
		hint: "Use IN (…) or a subquery with EXISTS"
	}
	"pg-ilike": { only: "postgres"; name: "ILIKE"; hint: "In SQLite LIKE is already case-insensitive" }
	"pg-distinct-on": { only: "postgres"; name: "DISTINCT ON"; hint: "Use a window function or GROUP BY" }
	"pg-array-contains": { only: "postgres"; name: "`@>` operator"; hint: "Use json_each(…)" }
	"pg-array-contained": { only: "postgres"; name: "`<@` operator"; hint: "Use json_each(…)" }
	"pg-array-overlap": { only: "postgres"; name: "`&&` operator"; hint: "Use json_each(…)" }
	"pg-similar-to": { only: "postgres"; name: "SIMILAR TO"; hint: "Use LIKE or GLOB" }
	"pg-json-path": { only: "postgres"; name: "`#>` / `#>>` operators"; hint: "Use json_extract(x, path)" }
	"pg-limit-all": { only: "postgres"; name: "LIMIT ALL"; hint: "Omit LIMIT" }
	"pg-lateral": { only: "postgres"; name: "LATERAL"; hint: "Use a correlated subquery" }
	"pg-create-type": { only: "postgres"; name: "CREATE TYPE"; hint: "Use TEXT with a CHECK constraint" }
	"pg-drop-type": { only: "postgres"; name: "DROP TYPE"; hint: "" }
	"pg-create-schema": { only: "postgres"; name: "CREATE SCHEMA"; hint: "SQLite has no schemas" }
	"pg-create-extension": { only: "postgres"; name: "CREATE EXTENSION"; hint: "" }
	"pg-grant": { only: "postgres"; name: "GRANT"; hint: "SQLite has no users or privileges" }
	"pg-on-conflict-constraint": {
		only: "postgres"
		name: "ON CONFLICT ON CONSTRAINT"
		hint: "Use ON CONFLICT (columns)"
	}
	"pg-delete-using": { only: "postgres"; name: "DELETE … USING"; hint: "Use a subquery" }
	"pg-fetch-first": { only: "postgres"; name: "FETCH FIRST"; hint: "Use LIMIT" }
	"pg-type-timestamptz": {
		only: "postgres"
		name: "`timestamptz` type"
		hint: "Use TEXT (ISO 8601) or INTEGER (unix time)"
	}
	"pg-type-jsonb": { only: "postgres"; name: "`jsonb` type"; hint: "Use TEXT or JSON" }
	"pg-type-uuid": { only: "postgres"; name: "`uuid` type"; hint: "Use TEXT" }
	"pg-type-bytea": { only: "postgres"; name: "`bytea` type"; hint: "Use BLOB" }
}

/** SQLT-53: PostgreSQL-only type names and the construct row each one gives (lower-case, words joined by one space). */
export type PgOnlyTypeNames = {
	timestamptz: "pg-type-timestamptz"
	"timestamp with time zone": "pg-type-timestamptz"
	"time with time zone": "pg-type-timestamptz"
	timetz: "pg-type-timestamptz"
	jsonb: "pg-type-jsonb"
	uuid: "pg-type-uuid"
	bytea: "pg-type-bytea"
}

export type DialectConstruct = keyof DialectOnlyConstructs

/**
 * Keyword phrases (1–3 lower-case words) that are a one-dialect construct, checked by the parser monad when it reads
 * the phrase's first token; the longest phrase wins. `<next>` in a hint is the word after the phrase.
 */
type DialectPhrases = {
	"::": "pg-cast"
	"insert or replace": "sqlite-insert-or-replace"
	"insert or ignore": "sqlite-insert-or-ignore"
	"insert or": "sqlite-insert-or"
	"replace into": "sqlite-replace-into"
	"alter column": "pg-alter-column"
	"add constraint": "pg-add-constraint"
	"add primary key": "pg-add-constraint"
	"add unique": "pg-add-constraint"
	"add foreign key": "pg-add-constraint"
	"add check": "pg-add-constraint"
	// SQLT-53 (#76). Constructs that need parser context (`ANY`, `DISTINCT ON`, `DELETE … USING`, type names) are checked by their parsers.
	"array [": "pg-array-ctor"
	"[ ]": "pg-array-type"
	ilike: "pg-ilike"
	"@>": "pg-array-contains"
	"<@": "pg-array-contained"
	"&&": "pg-array-overlap"
	"similar to": "pg-similar-to"
	"limit all": "pg-limit-all"
	"#>": "pg-json-path"
	"#>>": "pg-json-path"
	lateral: "pg-lateral"
	"create type": "pg-create-type"
	"create schema": "pg-create-schema"
	"drop type": "pg-drop-type"
	"create extension": "pg-create-extension"
	grant: "pg-grant"
	"conflict on constraint": "pg-on-conflict-constraint"
	"fetch first": "pg-fetch-first"
	"fetch next": "pg-fetch-first"
}

type PhraseHead<P> = P extends `${infer Head} ${string}` ? Head : P

/** First words of {@link DialectPhrases}: only these tokens pay for the lookahead. */
export type DialectPhraseHeads = PhraseHead<keyof DialectPhrases>

/** `[construct, number of words]` of the longest phrase `W1 W2 W3` starts with, or `never`. */
export type MatchDialectPhrase<
	W1 extends string,
	W2 extends string,
	W3 extends string,
> = `${W1} ${W2} ${W3}` extends infer P3 extends keyof DialectPhrases
	? [DialectPhrases[P3], 3]
	: `${W1} ${W2}` extends infer P2 extends keyof DialectPhrases
		? [DialectPhrases[P2], 2]
		: W1 extends keyof DialectPhrases
			? [DialectPhrases[W1], 1]
			: never
