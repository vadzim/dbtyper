# dbtyper roadmap

This document sketches where the project could go. It is aspirational and unordered unless noted; nothing here is a commitment to build.

## Active plan — decisions and sequence (2026-05)

The following items are **maintainer decisions** for upcoming work. They override older open questions in ad hoc notes. Details and backlog lines live in `**docs/TODO.md`\*\*.

### Locked decisions

1. **Function registry (types only, Option A)**
   Custom and extended built-in functions are modeled **only in types**: a `**functions?`** map on `**JsqlDatabaseShape**`/ migration-derived`**Db**`(e.g. passed through`**sqlMigrations`config** as part of the typed database shape). There is **no** separate runtime`**database().extendFunctions()`** API for typing in v1. Runtime registration, if ever added, must not become a second source of truth without codegen or explicit module augmentation.
2. **PostgreSQL arrays**
   Implement a **minimal slice** first (see `**docs/TODO.md` § Arrays**): enough real SQL to be useful without chasing full Postgres array semantics in one step. Fuller surface (multidimensional literals, slicing, full operator matrix, `**ANY`/`ALL`** interplay) stays **explicit backlog\*\*.
3. `**LATERAL` / correlated `FROM`\*\*
   **Not** required for v1 of subquery/correlation work. `**LATERAL`** and `**CROSS`/`LEFT JOIN LATERAL**` are **deferred** and listed under `**docs/TODO.md`\*\*.

### Work priority when time-bound

Execute in order; each slice should leave `**npm test**` green (`typecheck`, workspace checks, `**node --test**`).

| Order | Track                       | Contents                                                                                                                                                                                              |
| ----- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Core pipeline               | Function registry (**types/config**); fix `**SELECT`** routing (`**SkipToken**`before`**ParseSelect**`invariant); stabilize`**ApplyParsedStatements**`/`**Db\*\*` (no error types leaking as catalog) |
| **C** | `**GROUP BY` / `HAVING`\*\* | Parse + grouped result typing behind small commits                                                                                                                                                    |
| **D** | Subqueries                  | Scalar, `**EXISTS`**, `**IN (SELECT …)**`, correlation `**WHERE`/expression-level** — **without** `**LATERAL`** in v1                                                                                 |
| **E** | Arrays                      | Minimal slice only; expand only via `**TODO`\*\*                                                                                                                                                      |

### Implementation habits

- Prefer **small commits**: one logical change, `**npm test`\*\*, then commit.
- Large or risky features: **feature branch** and/or `**Db["features"]` (or equivalent) behind a flag\*\* so rollback is one revert.
- Known regression from experiments: `**ParseSqlStatement`** must not call `**ParseSelect<Tokens>**`with`**Tokens`still headed by`select**`unless`**ParseSelect**`itself consumes that keyword—the previous failure mode produced`**Expected SELECT (or WITH … SELECT) for row typing\*\*` for valid SQL.

---

## Vision

**dbtyper** aims to keep SQL and TypeScript in sync at compile time: SQL literals become structured types (rows, schemas, databases) with validation errors you can treat as data, not opaque failures. Over time it could grow from a narrow `CREATE TABLE` parser into a larger “types as documentation and contracts” layer between your schema and application code.

## Today (baseline)

- `CREATE TABLE` → column names, nullability, coarse SQL-to-TS type mapping
- Table, schema, and multi-schema database composition with duplicate-name checks
- Foreign keys: intra-schema, cross-schema, composite columns, arity vs referenced list, column existence on targets
- Explicit `DbtyperError<Code, "…">` messages with error codes suitable for strict type tests

Constraints that should stay visible in future work:

- Type-level cost must stay bounded; heavy features should remain opt-in where possible
- Preserve readable error messages and stable patterns for testing (literal messages, not vague templates)

---

## Near horizon (extend the same model)

- **More of DDL**: `ALTER TABLE` (add/drop column, add constraint) as type-level patches on an existing schema type; `DROP TABLE` / rename as schema diff concepts (even if only for documentation types)
- **Richer column metadata**: `DEFAULT`, `GENERATED`, check constraints that mention columns (parse + validate refs like FKs), `UNIQUE` / `PRIMARY KEY` as first-class facts for inference
- **Indexes and uniqueness**: model unique constraints and indexes enough to reason about “natural keys” in types (e.g. “lookup by email is valid”)
- **Dialect edges**: clearer split between “Postgres-ish” and portable subsets; optional strict mode per dialect
- **Ergonomics**: small helper types to pick row types, join keys, or “insert shape” vs “select shape” without new SQL syntax

## Mid horizon (schema as a platform)

- **Views and CTEs**: readonly row types from `CREATE VIEW` or a minimal `SELECT` subset (large type cost—likely behind explicit entry points)
- **Migrations as types**: ordered list of SQL snippets → schema version N; fail at compile time if a migration breaks FKs or renames columns still referenced elsewhere
- **Runtime bridge (optional package)**: parse the same SQL at runtime with a small parser, or generate JSON Schema / Zod from the type-level description for forms and APIs—without duplicating logic in incompatible ways
- **Query layer (experimental)**: tagged template or fluent API checked against `SqlDatabase` (e.g. selected columns and joins validated against known tables). This is easy to underestimate; a realistic goal might be “safe column/table identifiers” before full SQL typing
- **Tooling**: CLI or editor extension to print inferred types, list errors, or diff two schema types for CI

## Long horizon (where it could grow)

- **Multi-file / codegen workflow**: repository of `.sql` files → emitted `.d.ts` or a single module type, for teams that do not want SQL inside TS sources
- **Cross-language consumers**: export OpenAPI-ish or protobuf-style descriptions from the type-level schema for services in other languages
- **Data access patterns**: typed `INSERT`/`UPDATE`/`DELETE` row shapes, or ORM-adjacent helpers that stay zero-runtime if they only exist as types
- **Replication / sharding hints**: optional annotations (comments or extended syntax) for partitioning keys—only if they map cleanly to TS usage
- **Ecosystem**: integration examples (Drizzle, Kysely, raw `pg`) as recipes, not core library bloat

## Possible non-goals

- Replacing a full SQL parser or database planner in the type system
- Supporting every corner of SQL:2003+ in templates (cost explodes quickly)
- Silent widening of errors into `string` or `never` without a deliberate escape hatch

## How to use this document

Treat the **Vision**, **near/mid/long horizon**, and **non-goals** sections as **backlog themes** once **§ Active plan** is accounted for. When priorities shift, update **§ Active plan** and `**docs/TODO.md`\*\* together so decisions stay single-sourced.

For day-to-day shipped vs gaps, see `**docs/CURRENT.md**`.
