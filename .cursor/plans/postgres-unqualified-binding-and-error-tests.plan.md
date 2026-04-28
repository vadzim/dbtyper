# Postgres-like unqualified columns + reference error tests

## Product requirement

Unqualified single-column references must behave **like PostgreSQL** given the in-memory `JsqlDatabaseShape` and the current `FROM` / `JOIN` scope:

- If **exactly one** table (scope entry) exposes that column name, **bind** to that column’s TS and SQL type (same as today for the single-table case).
- If **zero** tables expose it → error (analogous to “column does not exist”).
- If **two or more** tables expose it → error (**ambiguous** column reference).

This replaces the current behavior where multi-table scope makes unqualified resolution **`never`** in SELECT ([`ResolveOneItemUnqualified`](src/parser/parse-select.ts)) or always **`SqlParserError<"Unqualified column in DELETE WHERE">`** in DELETE ([`ValidateDeleteColumnParts`](src/parser/parse-delete.ts) for `readonly [infer C]`).

## Implementation

### 1. Shared scope helpers (new module recommended)

Add something like [`src/parser/scope-unqualified-column.ts`](src/parser/scope-unqualified-column.ts) (name flexible) with type-level utilities only:

- **`ScopeKeysWithColumn<Scope extends ScopeMap, Col extends string>`**  
  Distribute over `keyof Scope`: union of alias keys `K` where `Col extends keyof Scope[K]["columns"]`.

- **`IsUnion<T>`** (or equivalent) so that when `ScopeKeysWithColumn` is a **union of two or more keys**, treat as ambiguous. When it is **`never`**, no match. When it is a **single** `infer K extends keyof Scope`, pick `Scope[K]` and reuse existing **`GetColMeta1Row`** / column meta logic.

- Stable **`SqlParserError<"...">` literals** aligned with intent (exact wording can mirror PG, e.g. ambiguous vs missing, as long as tests use full literals per [`.cursor/rules/sql-parse-tests.mdc`](.cursor/rules/sql-parse-tests.mdc)).

Export the resolver entry type used by both parsers, e.g. **`ResolveUnqualifiedColumnInScope<Scope, Col, As>`** returning `{ out; ts; sql } | SqlParserError<...>` to avoid duplicating `GetColMeta1` wiring.

### 2. SELECT — [`src/parser/parse-select.ts`](src/parser/parse-select.ts)

- Replace **`ResolveOneItemUnqualified`**: remove the `SingleAliasScope` false branch that returns **`never`**.
- For **one** scope entry, keep fast path (optional): delegate to existing **`ResolveOneUnqualifiedWhenScoped`** or call the shared resolver (should be equivalent).
- For **multiple** entries, call shared **`ResolveUnqualifiedColumnInScope`**.

### 3. DELETE — [`src/parser/parse-delete.ts`](src/parser/parse-delete.ts)

- In **`ValidateDeleteColumnParts`** for `Parts extends readonly [infer C extends string]` (bare column): replace the branch that errors with **`Unqualified column in DELETE WHERE`** when `SingleAliasScope` is false.
- Use the **same** shared resolver so SELECT and DELETE stay consistent.

With **current** grammar, `SingleAliasScope` for `DELETE` is **always true** (single `FROM` table only), so the multi-table branch is likely **unreachable** today; the change still **unifies** logic and avoids drift if multi-table `DELETE` is added later.

### 4. Documentation

- Update [`SUPPORTED-SQL.md`](SUPPORTED-SQL.md) **SELECT** and **DELETE** bullets: unqualified column names are resolved across **all** tables/aliases in scope; require **unique** owning column; otherwise ambiguous / unknown errors.

## Tests (compile-time)

### Behavior tests (Postgres-like unqualified) — **SELECT**

Add to [`test/parse-select.test.ts`](test/parse-select.test.ts) (extend `DbJoinDefaultAndExplicit` or add columns as needed):

| Scenario                                                        | Expected                               | Real-SQL note                                                                                         |
| --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `name` only on `users`, join with `subs` that has **no** `name` | Success: `name` binds to `users.name`  | Matches PG: unambiguous across visible row types. Fixture must not accidentally add `name` to `subs`. |
| `id` on **both** `users` and `subs`                             | `SqlParserError` **ambiguous** literal | PG errors when ≥2 join inputs expose the same column name. Add `id` to `subs` if missing.             |
| `nope` on neither table                                         | `SqlParserError` **unknown** literal   | PG: column does not exist.                                                                            |

**Optional SELECT tests (still “real SQL”, parser-supported):**

- **Bare alias column**: `select s.plan_code from users join billing.subs s on …` — already implied by join tests; keep one explicit success.
- **Wrong qualified `alias.col`**: `s.not_a_column` — already covered (`Unknown qualified column in SELECT`); pin exact literal.
- **Unqualified inside parentheses** in projection if the raw list allows only idents at top level — today list is `*` / param / ident chains only; **parens as expression** are not a separate projection form. **Skip** unless grammar extends.
- **Duplicate output labels** (`select u.id, s.id` without `AS`) — PG allows duplicate names in result metadata; merged `Record` types in TS may **collapse keys** — document as **known limitation**, not as “PG mismatch test” unless output shape is redesigned.

Use **`Matches<..., SqlParserError<`exact`>>`** / **`Expect<Matches<...>>`**; avoid `SqlParserError<string>` when a single message is intended ([`.cursor/rules/sql-parse-tests.mdc`](.cursor/rules/sql-parse-tests.mdc)).

### Behavior tests — **DELETE** (grammar reality)

`DELETE` in this codebase has **only one** `FROM` table (no `JOIN`, no `FROM a, b`, no `USING`). The `WHERE` scope therefore always has **exactly one** scope key (`table` or `AS` alias). So:

- **Ambiguous unqualified** (two tables both exposing `id`) is **not expressible** in current `DELETE` syntax — **do not** plan a DELETE mirror of the SELECT “ambiguous” row unless you first extend the parser (e.g. `USING` / comma-FROM).
- **Still worth testing for DELETE** (real SQL + current parser):
    - Unknown bare column: `where nope = 1` (already).
    - Unknown / wrong **qualified** and **3-part** refs (already / extend).
    - **`DELETE FROM users AS u WHERE users.id = …`**: PG would require using `u`; table name may not be in scope — treat like PG and assert **`Unknown qualified column in DELETE WHERE`** (or whatever literal the resolver emits).
- Shared **`ResolveUnqualifiedColumnInScope`** for DELETE remains useful for **one** consistent implementation and for **future** multi-table `DELETE` if added.

### Wrong-reference tests (SELECT / DELETE)

- **SELECT**: wrong 3-part (`Unknown column (schema.table.column)` / `Unknown schema or table in SELECT`), wrong alias (`Unknown table alias in SELECT`), bad `ON` left/right (`Unknown column in JOIN (left side)` / `…(right side)`), unknown `FROM` — keep and **pin full literals** where stable.
- **DELETE**: wrong `FROM`, wrong 2-part / 3-part `WHERE`, second conjunct bad column, alias vs table name after `AS` — same; **no** multi-table ambiguous DELETE until grammar supports it.
- Remove any assertion that multi-table bare `name` yields **`Unqualified column requires exactly one table in FROM`**; after SELECT work, expect **success** (unique) or **ambiguous/unknown** messages above.

### Out of scope vs Postgres (do not add tests until supported)

- **Subqueries**, **lateral**, **NATURAL JOIN**, **`JOIN` without `ON`**, **`USING`**, **correlated columns**, **`DELETE … USING`**, **`FROM` comma-list**, **typed `SELECT WHERE`**, **`GROUP BY` / `HAVING` / `ORDER BY`**, **set ops** — not modeled; tests would be misleading if they imply PG parity there.

### Identifier / catalog alignment

- PG folds **unquoted** identifiers to lowercase; tests should use **lowercase** names in SQL strings and in `JsqlDatabaseShape` keys unless you explicitly add quoted-ident fixtures per [`.cursor/rules/sql-quoted-identifiers.mdc`](.cursor/rules/sql-quoted-identifiers.mdc).
- Schema resolution follows the **explicit** `schemas` object, not `search_path` — document in comments next to multi-schema tests so “real SQL” expectations are not confused with PG session settings.

## Verification

- `npm test` (typecheck, monad checker, node test harness).

## Notes

- **`SELECT *`** with multiple scope entries stays as today (still requires a single table for expansion).
- **SELECT `WHERE`** remains skipped for typing; no change unless you later parse it structurally.
