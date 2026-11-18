# src/gram: per-dialect LR grammars at type level (track B, #52)

Shape and rationale: `DECISIONS.md`, "Track B: dialect selection shape (#52)" and "Grammar pipeline (#93)".

```
src/gram/<dialect>/gram.y      the dialect's bison grammar (vendored; postgres: PostgreSQL gram.y, scan.l for reference)
  | npm run gram:generate [-- <dialect>]     (scripts/gram-generate.mjs; needs only GNU bison >= 3, not flex)
  |   bison --xml  ->  gram.xml (temporary, ~70 MB)  ->  scripts/gram/xml2ts.ts
  v
src/gram/<dialect>/tables.ts   Shifts / Reductions / Gotos / Rules / Tables (LALR(1) automaton as types, committed)
src/gram/<dialect>/keywords.ts keyword text -> terminal name, from `%token <keyword>` (committed)
src/gram/<dialect>/tokens.ts   hand-written: lexer tokens (src/lexer/sql-lexer.ts) -> terminal names (+ parser.c lookaheads)
src/gram/driver.ts             shared recogniser: Recognize<Tables, Terminals> -> { ok: true } | { ok: false; at; token }
```

Use: `Recognize<Tables, PgTerminals<"select 1">>` (see `test/gram/`).

Regenerate: `npm run gram:generate` (about 20 s). If bison is missing the script prints an install hint.
`tables.ts` and `keywords.ts` are generated, committed, and excluded from prettier and eslint; do not edit them.
`src/gram` is excluded from `tsconfig.json` / `tsconfig.build.json` (the tables are heavy); `npm run gram:check`
typechecks it, and `test/gram/` (in `tsconfig.test.json`) exercises it.

Add a dialect `foo`: create `src/gram/foo/gram.y` (a bison grammar; convert other generators' grammars first, expand
what bison lacks), run `npm run gram:generate -- foo`, write `src/gram/foo/tokens.ts` mapping the lexer tokens to the
grammar's terminal names, and add tests in `test/gram/`. The driver is shared and unchanged.
