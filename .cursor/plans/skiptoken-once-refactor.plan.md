---
name: SkipToken-once refactor
overview: Eliminate duplicate `ParseSqlTokens` / `SkipToken` work by threading a single `TokensList` cursor through parsers. Constraint/FK path and CREATE TABLE wiring are largely done in the working tree. Remaining work includes hierarchical statement dispatch in sql-parse-statement (SqlCreate/SqlDrop/SqlAlter), leaf parser entry contracts, sql-column, Cursor rule, and tests.
todos:
  - id: statement-guards
    content: "Refactor sql-parse-statement: SqlStatement dispatches on first token only (PeekToken + one SkipToken to AfterVerb), then SqlCreate/SqlDrop/SqlAlter route to a single leaf; leaf Parse*Tuple assumes buffer after first keyword (no duplicate create/drop/alter reads). Replace union-of-all-leaves SqlStatement definition."
    status: completed
  - id: constraint-head
    content: "Replace ReadConstraintKeywordOnStripped + ReadConstraintEntryMatch contract: return [match, rest] with rest threaded; no SkipToken result discarded."
    status: completed
  - id: fk-buffer-bug
    content: Fix ValidateConstraintRefs and ParseForeignRefMeta to continue from buffer after FOREIGN KEY (thread AfterKw); no ReadFirstParenGroup from stale EB.
    status: completed
  - id: sql-column-helpers
    content: Refactor sql-column ReadIsArray / ScanForNotNullWithRest / ParseColumnFromBuffer to avoid PeekToken<SkipToken<B>> + SkipToken<SkipToken<B>> double chains.
    status: completed
  - id: cursor-rule
    content: Add SkipToken-once + no-discard-rest rule under .cursor/rules/ (extend parser-lookahead-tuples.mdc or new mdc with globs).
    status: completed
  - id: tests
    content: Run parser/type tests after merging working tree; confirm CREATE TABLE + FK paths still typecheck.
    status: completed
  - id: audit-discarded-rests
    content: "After implementation pass: double-check src/parser for discarded rests — rg for infer _ on ReadExpectedToken/ReadBufferEnd/SkipToken chains, PeekToken<SkipToken before ReadExpected from same B, nested SkipToken<SkipToken without binding intermediate rest."
    status: completed
isProject: false
---

> **Repo copy:** This file was restored from `~/.cursor/plans/skiptoken-once_refactor_e04051bc.plan.md`. Most items below are **implemented** on `main`; treat “still open” sections as historical unless you are auditing.

# SkipToken-once and tuple-threading refactor

## Progress (working tree — reviewed)

The current **unstaged** diff in [`src/parser/sql-constraints-fk.ts`](src/parser/sql-constraints-fk.ts) and [`src/parser/sql-create-table.ts`](src/parser/sql-create-table.ts) matches the plan’s intent for **constraint classification**, **threading `AfterKw`**, and **fixing the FOREIGN KEY stale buffer**.

- **`ReadConstraintKeywordOnStripped` / discard `Original`:** **Done** — returns `["primary_key" \| "unique" \| "foreign_key" \| "other", AfterKw]` or `false`; `AfterKey` / `SkipToken<EB>` are returned and used.
- **`ReadConstraintEntryMatch` contract:** **Done** — `[Kind, EB, AfterKw]` on match, `[false, B, B]` for columns; [`ParseCreateBody`](src/parser/sql-create-table.ts) passes `Kind`, `ColStart`, `AfterKw` into `ParseCreateBodyOneCommaSegment`.
- **`ValidateConstraintRefs` re-tokenizing:** **Done** — `ValidateConstraintRefs<Kind, AfterKw, Names>`; no second strip / no duplicate `PRIMARY`/`FOREIGN`/`KEY` reads.
- **FK buffer bug:** **Done** — `ValidateForeignKeyConstraintBodyBuffer<AfterKw>` and `ParseForeignRefMetaAfterKey<AfterKey>` (replacing `ParseForeignRefMetaAfterStrip`) use the buffer **after** `FOREIGN KEY`.
- **Hierarchical `SqlStatement` dispatch:** **Not in diff** — still open (see §1 below; supersedes per-file guard-only fixes).
- **`sql-column.ts` double skips:** **Not in diff** — still open.
- **Cursor rule:** **Not in diff** — still open.

**Alignment check:** The new flow is exactly what the plan described: **one extraction** of composite heads in `ReadConstraintKeywordOnStripped`, **`AfterKw` threaded** into `ValidateConstraintRefs` and `ParseForeignRefMeta<Kind, AfterKw>`, and **callers** (`RefsWithOptionalFkMeta`, `ParseCreateBodyOneCommaSegment`) updated so metadata extraction does not re-strip the buffer.

**Minor follow-ups (optional, non-blocking):**

- `ValidateConstraintRefs` still uses `infer _` for the closing-paren rest from `ReadFirstParenGroup` where only the inner buffer is needed — acceptable if that rest is intentionally unused; could rename to `infer _AfterClose` for the rule about naming.
- Run [`src/tests/sql-create-table.test.ts`](src/tests/sql-create-table.test.ts) (and full suite) once changes are staged — not verified in this review.

---

## Problem (unchanged)

- [`SkipToken`](src/parser/sql-tokens.ts) is `ParseSqlTokens<B["__rest__"]>` — **each reference instantiates full re-lexing from that string**.
- [`PeekToken`](src/parser/sql-tokens.ts) is cheap: `B["__token__"]` only.
- Anti-patterns: **`PeekToken<SkipToken<B>>` guards** plus a later **`ReadExpectedToken<B, …>`** from the same `B`, or discarding **`[true, infer _]`** rest from reads.

Existing guidance: [`.cursor/rules/parser-lookahead-tuples.mdc`](.cursor/rules/parser-lookahead-tuples.mdc).

---

## Remaining work (highest impact first)

### 1. Hierarchical statement routing in [`sql-parse-statement.ts`](src/parser/sql-parse-statement.ts) (still open)

**Why the current shape is costly**

- [`SqlStatement`](src/parser/sql-parse-statement.ts) is implemented as a **union** of five leaf parsers passed through one conditional (`SqlAlterTable<Buffer> | … | SqlDropTable<Buffer> extends infer Result`). For a buffer like `create table …`, TypeScript still has to relate **each** union member to the result; in practice **both** [`SqlCreateSchema`](src/parser/sql-create-schema.ts) and [`SqlCreateTable`](src/parser/sql-create-table.ts) are pulled in, and **each** repeats `PeekToken<B> extends "create"` plus `PeekToken<SkipToken<B>>` for the second keyword, then each `Parse*Tuple<B>` runs **`ReadExpectedToken` from `B` again** for `create` (and `schema` / `table`). Lexing **unquoted identifiers / long tokens** is the hottest path; duplicating leading-keyword work multiplies that cost before routing even wins.

**Target architecture (user direction)**

1. **`SqlStatement<B>`** — Inspect **only the first token** with `PeekToken<B>`, branch on `"create" | "drop" | "alter"` (and unknown → error tuple). **Once** advance with `SkipToken<B>` → `AfterVerb`, and pass **`AfterVerb`** down. No second keyword peek at this tier.
2. **`SqlCreate<AfterVerb>`** (new, same module or `sql-parse-statement-routing.ts`) — `PeekToken<AfterVerb>` routes to **`SqlCreateTable<AfterVerb>`** vs **`SqlCreateSchema<AfterVerb>`** (only one leaf is selected). Buffer contract: **`AfterVerb` is immediately after the `create` token.**
3. **`SqlDrop<AfterVerb>`** — same idea: **`SqlDropTable`** vs **`SqlDropSchema`** from `PeekToken<AfterVerb>` (`"table"` vs `"schema"`).
4. **`SqlAlter<AfterVerb>`** — today only **`SqlAlterTable`**; same pattern for future alter variants.

**Leaf parser contract**

- [`SqlCreateTable`](src/parser/sql-create-table.ts), [`SqlCreateSchema`](src/parser/sql-create-schema.ts), [`SqlDropTable`](src/parser/sql-drop-table.ts), [`SqlDropSchema`](src/parser/sql-drop-schema.ts), [`SqlAlterTable`](src/parser/sql-alter-table.ts): remove the outer `PeekToken<B> extends "create"` / `"drop"` / `"alter"` **and** the inner `PeekToken<SkipToken<B>>` second-keyword peek **if** the parent already guarantees `B` is **after** the first keyword. **`Parse*Tuple`** should begin with **`ReadExpectedToken<B, "table" | "schema" | …>`** (single leading keyword from the cursor the parent handed in). Finalize / error shapes stay the same.
- **Exports:** [`src/sql.ts`](src/sql.ts) exposes only `SqlStatement` / `SqlStatements*` — leaf types can stay internal. Tests that import leaf types from parser files are grep-clean for direct `SqlCreateTable<…>` usage outside definitions, so narrowing the leaf contract is safe as long as **`SqlStatement` remains the single public entry** used by tests.

**Optional primitive**

- A small `ReadFirstKeyword<B>` → `[verb, AfterVerb]` or falsy + `B` tuple can centralize the one `SkipToken` at the top (mirrors existing tuple style in `sql-parse-primitives.ts`).

### 2. [`src/parser/sql-column.ts`](src/parser/sql-column.ts)

Still needs helpers that bind **one** `SkipToken` per step instead of `PeekToken<SkipToken<B>>` + `SkipToken<SkipToken<B>>` on success paths.

### 3. Lower priority cleanups

- `infer _` on [`ReadBufferEnd`](src/parser/sql-parse-primitives.ts) success branches in constraints (EOF rest).
- Dummy `infer _ extends TokensList` where second slot is `EmptyTokenList` — style only.

### 4. Cursor rule

Add SkipToken-once + no-discard-rest section (new file or extend `parser-lookahead-tuples.mdc`).

---

## Verification

- Run parser / type tests, especially [`src/tests/sql-create-table.test.ts`](src/tests/sql-create-table.test.ts), after integrating the working tree.

### Double-check discarded `rest` (mandatory before considering the refactor done)

Re-scan [`src/parser/**/*.ts`](src/parser) for patterns where an advanced buffer from **`SkipToken`**, **`ReadExpectedToken`**, **`ReadExpectedIdentifier`**, or **`ReadOptionalToken`** is computed but **not** passed as the next parameter:

- `extends [true, infer _]` or `extends [true, infer _ extends TokensList]` when the first slot came from a read that advanced the cursor.
- `extends [..., infer _ extends TokensList]` on tuple results that carry a real `TokensList` (distinguish intentional dummy `EmptyTokenList` tails in validators).
- `PeekToken<SkipToken<…>>` in the same branch as a later `ReadExpectedToken<B, …>` / `Parse*Tuple<B>` from the **same** pre-skip `B`.
- `ReadToken<SkipToken<SkipToken<…>>>`-style deep nesting without binding the inner `SkipToken` result to a name that flows forward.

Fix or document any hit; prefer naming `infer Rest` / `infer AfterKw` and threading through the next type in the chain (same rule as the planned Cursor doc).
