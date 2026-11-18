# DECISIONS (technical choices; the product spec lives in dbtyper-spec)

## 2026-11-18 — Track B: dialect selection shape (#52, DSEL-1…DSEL-11)

Track B (`sqlite-pg/bison-track`) builds dialect selection on bison-generated LR grammars driven at type level (`src/gram/`).

- **One grammar per dialect.** `src/gram/postgres/` (PostgreSQL `gram.y`, vendored) and `src/gram/sqlite/` (SQLite's lemon
  `parse.y` converted to bison). Each is turned by one reproducible script (`npm run gram:generate`) into TS table types.
  One shared type-level LR driver (`src/gram/driver.ts`) runs either table set. Lemon features bison lacks (`%fallback`
  keyword→ID, `%token_class`, `%wildcard`) are expanded by the converter or handled by the driver's per-grammar fallback map.
- **The dialect is a type on the driver** (`DriverConfig["dialect"]`: `"postgres" | "sqlite"`, DSEL-1, DSEL-8). It is
  threaded from `sqlMigrations({ driver })` to every migration, typed query and stream of the chain (DSEL-3); two chains
  never share it (DSEL-4). The untyped API never reads it (DSEL-9). SQL text is never rewritten (DSEL-10).
- **The grammar is the syntax authority; typing stays shared.** A statement is first recognised by its dialect's
  grammar (accept, or reject at token i). Accepted statements are typed by the shared typer (today the hand-written
  `src/parser` typer inherited from the base, told the dialect). Type-level semantic actions that replace that typer are
  the job of the track-B core-typing issues (#55, #58, …), not of #52.
- **Other-dialect errors by two grammars** (DSEL-5…7). Rejected by its own grammar and accepted by the other dialect's
  grammar ⇒ an other-dialect error with its own code (distinct from syntax errors), naming the construct from the token
  where the own grammar failed (table: `::` → "`::` cast", `or` after `insert` → "INSERT OR REPLACE", backtick
  identifier, …; unknown token ⇒ generic "… is PostgreSQL-only/SQLite-only near <token>"). Rejected by both ⇒ syntax error.
- **When the grammar runs** (cost; baseline ~0.5 s table load + ~6–7 ms/token, TS2589 at ~400 tokens on the PG grammar):
  SQLite chains always pass through the SQLite grammar (the inherited typer is PostgreSQL-shaped and would over-accept).
  PostgreSQL chains run the grammars only on the error path (the typer reported a syntax error), so the existing PG test
  suite keeps its speed. If the driver gets fast enough (#22 targets), PG chains may gate always; decided by measurement.

Sub-issues of #52: see the issue. #21 (hygiene) and #22 (driver performance) are folded into them.

## 2026-11-18 — Grammar pipeline (#93, track B)

- **Layout.** `src/gram/<dialect>/{gram.y,tables.ts,keywords.ts,tokens.ts}`, shared `src/gram/driver.ts`, one script
  `npm run gram:generate [-- <dialect>]` (`scripts/gram-generate.mjs` → bison `--xml` → `scripts/gram/xml2ts.ts`). Only
  bison is needed; the script prints an install hint when it is missing. See `src/gram/README.md`.
- **Tables are committed, not generated at build.** Reason: generation takes ~20 s and needs bison, which contributors
  and CI should not need to typecheck; the file is deterministic from `gram.y`, so a diff after `gram:generate` means a
  stale commit. They are excluded from prettier/eslint and from `tsconfig.json`/`tsconfig.build.json` (`src/gram`), so the
  main `typecheck` does not pay for them (nothing in `src/` outside `src/gram` imports them yet); `gram:check` and
  `test/gram/` do.
- **Dropped from the #21 list:** `bison-transform.ts`, `gram1.y`, `gram-transformed.txt` (exploratory, tables never came
  from them), `example.ts` (superseded by tests), the value stack and Engine of the old `parser.ts` (recogniser only).
  `scan.l` is kept next to `gram.y` as reference for the token mapping.
- **Token mapping** (`postgres/tokens.ts`): lexer tokens → terminals; PG's one-token lookaheads (`not_la`, `nulls_la`,
  `with_la`, `without_la`, `format_la`) are computed there, so the `with_la` hack is removed from `parser-monad.ts`.
  An ident whose text is a PG keyword (not in the lexer's keyword list) is read as that keyword, because the lexer
  cannot tell `"analyze"` from `analyze`; accepted limitation of the recogniser.
