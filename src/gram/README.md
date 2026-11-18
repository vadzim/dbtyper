# src/gram: per-dialect LR grammars at type level (track B, #52)

Shape and rationale: `DECISIONS.md`, "Track B: dialect selection shape (#52)" and "Grammar pipeline (#93)".

```
src/gram/<dialect>/gram.y      the dialect's bison grammar (vendored; postgres: PostgreSQL gram.y, scan.l for reference)
  | npm run gram:generate [-- <dialect>]     (scripts/gram-generate.mjs; needs only GNU bison >= 3, not flex)
  |   bison --xml  ->  gram.xml (temporary, ~70 MB)  ->  scripts/gram/xml2ts.ts
  v
src/gram/<dialect>/tables.d.ts Actions / Gotos / Tables (LALR(1) automaton as types, committed; a .d.ts on purpose, see below)
src/gram/<dialect>/keywords.ts keyword text -> terminal name, from `%token <keyword>` (committed)
src/gram/<dialect>/tokens.ts   hand-written: lexer tokens (src/lexer/sql-lexer.ts) -> terminal names (+ parser.c lookaheads)
src/gram/driver.ts             shared recogniser (+ counters.d.ts: index tables): Recognize<Tables, Terminals> -> { ok: true } | { ok: false; at; token }
```

Use: `Recognize<Tables, PgTerminals<"select 1">>` (see `test/gram/`).

Regenerate: `npm run gram:generate` (about 20 s). If bison is missing the script prints an install hint.
`tables.d.ts` and `keywords.ts` are generated, committed, and excluded from prettier and eslint; do not edit them.
`tables.d.ts` is a declaration file so that `skipLibCheck` skips checking 600 KB of types (import it with `import type`, path
`.../tables.d.ts`); it ends with `export {}` so the checker does not resolve its helper types as exports.
`src/gram` is excluded from `tsconfig.json` / `tsconfig.build.json` (the tables are heavy); `npm run gram:check`
typechecks it, and `test/gram/` (in `tsconfig.test.json`) exercises it.

Add a dialect `foo`: create `src/gram/foo/gram.y` (a bison grammar; convert other generators' grammars first, expand
what bison lacks), run `npm run gram:generate -- foo`, write `src/gram/foo/tokens.ts` mapping the lexer tokens to the
grammar's terminal names, and add tests in `test/gram/`. The driver is shared and unchanged.

Performance (#95, #22): `npm run gram:bench [-- --compiler tsc]` measures fixed load, ms/token and the longest statement
(see `scripts/bench-gram.mjs`; run it on a quiet machine, it prints `uptime`). Numbers and the reasons for the table
encoding and the driver shape: `DECISIONS.md`, "LR driver performance (#95)". Rules to keep when changing the driver:
no `keyof` on table types (use `Table extends Record<Key, infer V>`), no O(n) tuple operations per step, one automaton
step costs ~50 type instantiations so count them.
SQLite (#96): `src/gram/sqlite/parse.y` is SQLite's lemon grammar, vendored from release tag `version-3.54.1`
(`src/parse.y`, plus `tool/mkkeywordhash.c` for the keyword table; both public domain, a header line records the tag).
`npm run gram:generate -- sqlite` first runs `scripts/gram/lemon2bison.mjs` (parse.y -> `gram.y`, `fallback.json`,
`keywords.ts`; its header lists what it expands), then the usual bison + `xml2ts.ts` path. `tokens.ts` (`SqliteTerminals`)
is hand-written; terminal names are parse.y's, lower case. To update SQLite: replace the two vendored files, re-add the header
line, regenerate, run the tests. Bench: `npm run gram:bench -- --dialect sqlite`.
Lemon grammars (`%fallback`): a table set may export `Fallback` (terminal -> terminal tried when the state has no
explicit action for the first one); the driver is otherwise unchanged. `test/gram/driver.test.ts` shows the table encoding on toy tables.
