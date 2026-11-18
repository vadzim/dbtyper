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
