/**
 * Quoting cases shared by the type-level lexer (test/framework/lexer-scanner-cases.test-d.ts) and the run-time scanner
 * (test/runtime/sql-text-scanner.test.ts): `params` is how many parameter markers (`?` in SQLite, `:p` in PostgreSQL)
 * the text has outside strings, quoted names, comments and dollar bodies. A new quoting rule in the lexer gets a row
 * here, and both sides must agree on it. Not listed: nested block comments in SQLite. SQLite ends a comment at the first
 * close (the run-time scanner does, test "PostgreSQL block comments nest, SQLite ones end at the first close"), but the
 * type-level lexer nests them in both dialects: a difference to settle in the lexer (batch 1 of #175).
 */
export const scannerCases = [
	{ dialect: "sqlite", sql: "select '?', \"?\", ?", params: 1 },
	{ dialect: "sqlite", sql: "select `?`, [?], ?, ?", params: 2 },
	{ dialect: "sqlite", sql: "select 1 -- ?\n, ?", params: 1 },
	{ dialect: "sqlite", sql: "select /* ? */ ?", params: 1 },
	{ dialect: "sqlite", sql: "select 'it''s ?', ?", params: 1 },
	{ dialect: "postgres", sql: "select ':p', \":p\", :p", params: 1 },
	{ dialect: "postgres", sql: "select 1 -- :p\n, :p", params: 1 },
	{ dialect: "postgres", sql: "select /* :p /* :p */ :p */ :p", params: 1 },
	{ dialect: "postgres", sql: "select $$ :p $$, $t$ :p $$ :p $t$, :p", params: 1 },
	{ dialect: "postgres", sql: "select 'it''s :p', :p", params: 1 },
] as const
