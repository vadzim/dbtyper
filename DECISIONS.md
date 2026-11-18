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

## 2026-11-18 — LR driver performance (#95, #22, track B)

Benchmark: `npm run gram:bench` (`scripts/bench-gram.mjs`): `Recognize<Tables, [terminals]>` for statements `select a + 1 , b + 1 , ... from t`
of 100...3900 terminals, median of 3-5 runs, CPU time and `--extendedDiagnostics`. The measuring machine was loaded
(load average 40-60 on 16 cores, other agents), so wall times are inflated 2-3x; instantiations are exact, CPU time is
the steadier figure. Before = #93 (origin/sqlite-pg/bison-track 3b08a14), after = this change, PostgreSQL tables, tsgo 7.0.0-dev.20260514.1:

|                                                                      | before                       | after                                                   |
| -------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| fixed load (4 terminals, check time wall / cpu incl. compiler start) | 0.45-1.3 s / 1.0-1.4 s       | 0.06-0.12 s / 0.40 s                                    |
| per terminal (cpu slope)                                             | ~4.7 ms (680 instantiations) | ~0.22 ms (176 instantiations)                           |
| longest statement without TS2589                                     | 260 terminals (280 fails)    | 3900 (limit is the `Inc` table, 4000, then `$too-long`) |
| memory at 200 terminals                                              | 122 MB                       | 56 MB (59 MB at 1000, 68 MB at 3900)                    |
| tsc 6.0.3: fixed load check / cpu                                    | 2.6 s / 4.2 s                | 0.25 s / 1.7 s                                          |
| tsc: per terminal (cpu slope)                                        | ~1.7 ms\* (502 inst)         | 0.72 ms (176 inst)                                      |

(\*) two-point estimate under load. Targets of #22 (1000 terminals without TS2589, <= 1 ms/token, fixed load <= 0.3 s on
tsgo) are met on tsgo; on tsc the fixed load check is 0.25 s but parse+bind of the 660 KB tables dominates the rest.
The statement shape matters: real statements with deep nesting need more steps per token than this flat select list.

What changed and what each part bought (measured, in order):

1. **Two-level tail loop.** TypeScript stops a tail-recursive conditional type after 1000 iterations, a step per
   iteration capped statements at ~300 tokens. `Chunk` runs 100 steps tail-recursively and returns `{ index, stack }`, `Run` restarts it.
2. **Token index instead of `Rest` tuple.** Taking the tail of the token tuple at each shift (and `Seen` growth) was
   O(n) per step: 1000 tokens cost 1.25 M instantiations and 718 MB, 2000 tokens 2.5 GB. Tokens are read as `All[Index]`
   with an increment table (`counters.d.ts`, 4000 entries: this is the length limit); fuel is a table too (a tuple counter is O(length)).
3. **Flat rows.** `Actions` (shifts and reductions merged: number = shift, `R<k> = [pops, nonterminal]` = reduce,
   `"accept"`) and `Gotos` are rows shared through `interface X extends Part1, Part2` (an interface is resolved once to a flat
   member table; intersections of 727 helper types were resolved at every lookup). `Rules` is gone (the reduce action carries pops and nonterminal).
4. **Unit-rule chains.** A state whose only action is the default reduction of a one-symbol rule is lookahead-independent
   and leaves the states below alone, so a whole run (`Iconst -> AexprConst -> c_expr -> a_expr ...`) is a function of the
   state below it: `Actions[q].$default = { stateBelow: endState }`, one step instead of 3-8. (Precomputed in `xml2ts.ts`;
   instantiations per token 230 -> 165 with these.) The 500 k entries are shared as interface parts (tables 478 -> 614 KB).
5. **`tables.d.ts`.** With `skipLibCheck` the checker does not check the 600 KB of types (it did: 0.2-0.7 s fixed load);
   `export {}` is needed because a .d.ts exports every declaration otherwise and importing it then resolves all 14 k symbols (0.65 s).
6. **No `keyof` on tables; lookups as `Table extends Record<Key, infer V>`.** tsc recomputes `keyof` of a 7000-key object
   at every use (10 s for 400 tokens before this); `Record` probes are O(1) in both compilers (tsgo: +35% instantiations, tsc: 25 ms/token -> 0.7).
7. The lookahead `Tok` is carried and recomputed on shift only (`Peek` per step was a third of the time in tsgo).

Not done: collapsing runs that start in states with explicit shifts (a lookahead-dependent default reduce), non-unit
default reductions, a pure `%fallback`-free fast path (the fallback probe costs one conditional on default-reduce steps).
Correctness check (not committed): 685 mutated token sequences (deletions, substitutions, insertions, truncations of 8
statements) give identical results with the #93 driver/tables and the new ones. Tests: `test/gram/` (+ toy tables in `driver.test.ts`, 2000-terminal statements).
Tables are now `tables.d.ts`: import with `import type ... from ".../tables.d.ts"`. Other files kept: counters in `src/gram/counters.d.ts` (hand-generated, see its header).

## 2026-11-18 — SQLite grammar (#96, track B)

- **Source.** SQLite `version-3.54.1` `src/parse.y` and `tool/mkkeywordhash.c`, vendored in `src/gram/sqlite/` (header line
  records the tag). `scripts/gram/lemon2bison.mjs` converts (run by `gram:generate` when a dialect has `parse.y`):
  actions/aliases dropped; `%if*` evaluated with only `SQLITE_UDL_CAPABLE_PARSER` defined (so no `SQLITE_OMIT_*`, and
  `DELETE/UPDATE ... ORDER BY/LIMIT` parse); `%token_class` and `A|B` in a rule body expand to one rule per member (kept
  equal to lemon's multiterminal, no extra nonterminal that could add conflicts); `%wildcard ANY` becomes the nonterminal
  `any_token` (all terminals except LP, RP, COMMA, the only use being the virtual-table argument list); `%fallback` goes to
  `fallback.json`, which `xml2ts.ts` emits as `Fallback` in `tables.d.ts` (driver unchanged).
- **Precedence differences lemon vs bison, handled in the converter.** A rule's precedence is its FIRST precedence terminal in
  lemon (last in bison): every rule gets an explicit `%prec`. Reduce/reduce conflicts: lemon takes the higher-precedence
  rule, bison the earlier one: precedence-carrying rules of a nonterminal are reordered (higher first). The remaining 62
  bison R/R warnings (`IS NOT expr` vs `NOT expr`, `BETWEEN .. AND` vs `AND`) are resolved like lemon and silenced
  (`-Wno-conflicts-rr`, only for lemon grammars); no shift/reduce conflicts.
- **Known deviation.** Lemon's fallback is tried when the lookahead has no action; with bison's default reductions
  (most common reduce, no explicit lookahead list) a keyword that legally follows a default reduction but where the state also
  shifts `ID` is read as `ID` first. Lemon makes the same compression, so results should agree; not checked beyond the tests.
- **Lexer (additive, behind flags not in the default `LexerFeatures`).** `sqlite-lexemes`: backtick and `[bracket]` identifiers,
  `?NNN`, `@name`, `$name`. `quoted-ident-kind`: `"x"` is a `quoted_ident` token. PG's default token syntax now has
  `quoted-ident-kind`, so PG's `"analyze"` is an `ident`, not the keyword (fixes the #93 limitation; PG tests unchanged).
  Both token mappings now stop at a lexer error (the former loop did not advance on an error token: TS2589).
- **Token mapping.** `sqlite/tokens.ts`: keyword text from mkkeywordhash.c, WINDOW/OVER/FILTER only in their tokenize.c context,
  final `semi` appended. Left out: blob `x'..'`, doubled quote escapes in backtick/bracket identifiers, hex and `1_000`
  numbers, `$name(..)` tcl forms.
- **Numbers.** Bench `gram:bench -- --dialect sqlite` (flat `select a + 1, ...` statements) in the PR report.

## 2026-11-18 — Dialect gate (#97, track B)

- **Where.** `src/core/dialect-gate.ts` (`GateError`), called by `CheckSqlValid` (apply, query) and `CheckSqlValidForStream`
  (stream) in `src/core/sql-database.ts` with the shared typer's own error as the fallback. Errors 1900 (PostgreSQL-only
  syntax, SQLite driver) and 1901 (SQLite-only syntax, PostgreSQL driver), exactly the DSEL-7 codes (spec 93361f8).
- **Algorithm.** Own grammar rejects at token `at`, other grammar accepts => other-dialect error naming the construct,
  from the raw lexer token at `at` (re-lexed with the same syntax) and the terminals around it: `::` cast, ILIKE, `$n`
  parameter (SQLite chain); INSERT/UPDATE OR <word>, REPLACE INTO, PRAGMA, `?NNN` parameter, backtick identifiers (a
  backtick in the text, because PostgreSQL reads a backtick as an operator and fails a token later) (PostgreSQL chain).
  An unrecognised construct gives the generic "syntax near `x` is ...-only" **only when the typer has no error**; the other
  grammar is looser in places (SQLite takes any word as a table option, drops all actions), and then the typer's message
  ("Expected INTO after INSERT") is the better one. Both reject => the typer's error, or for SQLite (typer over-accepts)
  `UNEXPECTED_TOKEN`.
- **Gating decision.** SQLite chains: always (the grammar is the only SQLite syntax authority). PostgreSQL chains: error path
  only (`PgAlwaysGate = false`, a one-line switch). Measured with tsgo (`tsgo --noEmit -p tsconfig.test.json`, whole test
  typecheck, machine load 10-30, 3 runs each, check time):
  baseline (before #97) 2.0-2.1 s / 4.80 M instantiations; error path 2.2 s / 6.58 M (includes the 20 new gate tests);
  PG always gated 2.7-2.85 s / 9.34 M, memory 1.02 GB vs 0.86 GB. No TS2589 and no false reject in the whole existing
  suite either way, but always-on costs +0.7 s (+35 %) of ~2 s for a verdict that matters only when the typer already
  accepted a statement the PG grammar rejects. Not worth it now; revisit when the typer is replaced by grammar actions.
- **PostgreSQL `?`.** A bare `?` is the terminal `$error` in the PG token mapping (SQLite parameter; jsonb `?` is not typed by
  dbtyper), so `select ?1` is rejected by the PG grammar (DSEL-4). A bare `?` without a number is still the typer's 1007.
- **Lexer.** Under `dialect-sqlite` with `question-params`, `?NNN` is the indexed parameter NNN (was `?` then `NNN`), DSEL-4.
- **Bug fixed from #94.** `ParamsDriverConfig` was `Config & { syntax: ... | "dialect-x" }`: the intersection with the driver's
  own `syntax` removed the dialect flag. It is now an explicit object type, so the flag reaches the lexer.
- **False-reject guard.** The #96 grammar gaps (blob `x'..'`, hex `0x`, `1_000`, doubled quote in backtick/bracket
  identifiers, `$name(..)`) make the SQLite token stream wrong; when the text contains one (template match
  `SqliteLexGap`), the gate stays silent and the typer's error stays. A text with `x'`/`0x` inside a string is also skipped:
  harmless. Not mapped, because each needs the lexer to produce a new token kind.
- **SQLite chains in tests.** `create schema` is PostgreSQL-only (DSEL-5) and the shared typer knows no SQLite schema, so
  SQLite chains cannot create tables until #68...#77; `test/dialect/dialect-driver.test.ts` lost its SQLite `create schema`
  and table (SQLite typed `select 1 as id` instead). With the real `SqliteDriverConfig` a literal is typed `never` for the same reason.
- **Packaging.** The gate imports `src/gram/**/*.d.ts` from `src/core`, which `tsc` does not emit: `npm run build` runs
  `scripts/copy-gram-dts.mjs` afterwards.
