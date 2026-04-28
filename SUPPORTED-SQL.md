# Supported SQL (parser)

This document lists **SQL surface area that the type-level parser understands** today: routing, schema shape updates, and validation. **Update this file whenever you add or change parser support** for a statement or construct.

Lexing, token types, and monad mechanics are out of scope here.

---

## Statement routing

`ParseSqlStatement` dispatches on the leading keyword:

| Prefix                        | Behavior                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `CREATE` + `TABLE` / `SCHEMA` | Parsed; may **merge** into `JsqlDatabaseShape`                                                               |
| `DROP` + `TABLE` / `SCHEMA`   | Parsed; may **remove** from `JsqlDatabaseShape`                                                              |
| `DELETE`                      | Parsed; **checked** against the DB (especially `WHERE`); does **not** mutate the schema object               |
| `SELECT`                      | Parsed; projection/joins checked; does **not** mutate the DB                                                 |
| Anything else                 | **Skipped** to the next `;` (or end): bracket-aware forward scan (`SkipBracketedUntil`), no structured parse |

Multi-statement scripts are handled by walking the token stream (e.g. `ApplyParsedStatements`) until end or error.

---

## `CREATE SCHEMA`

- Optional **`IF NOT EXISTS`** (full keyword sequence as implemented).
- One **identifier** (schema name), then **`;`** or end of input.
- Adds an empty schema to `schemas`, or errors if the schema already exists (unless `IF NOT EXISTS`).

---

## `CREATE TABLE`

- Optional **`IF NOT EXISTS`**.
- **Qualified** `schema.table` or **unqualified** `table` (uses `defaultSchema`); schema must exist in the shape.
- **`(` … `)`** column list, then **`;`** or end.
- **Columns**: name + **type** from a run of **identifier** tokens (multi-word types, e.g. `timestamp with time zone`), mapped via `SqlScalarTypeMap` (uuid, text, integer/int, bigint, smallint, boolean/bool, numeric/decimal, real/float, double precision, json/jsonb, date, timestamp variants, time variants, varchar/character varying, char, etc.). Unlisted spellings map to **`unknown`** at the TS level.
- Optional **`NULL`** / **`NOT NULL`** after the type.
- **`CONSTRAINT` …** lines: enough structure to **skip** a typical `CONSTRAINT name PRIMARY KEY ( … )` (balanced parens); constraints are **not** merged into `JsqlTableShape` from this path.
- With **`IF NOT EXISTS`** when the table **already** exists: table body is **skipped to `;`** without merging.

---

## `DROP SCHEMA` / `DROP TABLE`

- Optional **`IF EXISTS`** (as implemented per statement).
- Identifier / qualified name forms supported by the parser; **`;`** or end.
- Removes schema or table from the in-memory shape when applicable (behavior depends on existence and `IF EXISTS`).

---

## `SELECT`

- Optional **`DISTINCT`**.
- **Select list**: `*`; **parameters** (`:name` style per lexer); **`schema.table.column`**, **`alias.column`**, bare **`column`** resolved across **all** `FROM` / `JOIN` bindings (Postgres-like): **unique** owning column succeeds; **zero** → error; **two or more** → ambiguous error. Optional **`AS alias`**. Comma-separated items.
- **`*` must be the only** projection in the list.
- **`FROM` is required** after the select list.
- **`FROM`**: `schema.table` or `table` (default schema); optional **table alias**.
- **`JOIN`**: **`INNER JOIN`**, **`LEFT [OUTER] JOIN`**, **`JOIN`**. Each joined table must be followed by **`ON alias.column = alias.column`** (equality only; columns validated against join scope).
- Optional **`WHERE`**: **not** deeply type-checked; bracket-aware **skip** to **`;`**.
- Statement ends with **`;`** or end after the parsed tail.
- Output type: **`JsqlSelectStatementResult`** (`kind`, `columns`, `column_sql_types`). Passing DB value is unchanged.

---

## `DELETE`

- **`DELETE FROM`** then the same **table reference** and **optional alias** style as `SELECT`.
- Optional **`WHERE`** (parsed and checked, limited grammar):
    - **`NOT`**, **`AND`**, **`OR`**, parenthesized groups.
    - Operands: literals (`true` / `false` / `null`), strings, numbers, parameters; qualified / unqualified column identifiers (bare name: same **unique / ambiguous / missing** rules as `SELECT` over the single `FROM` scope); parenthesized subexpressions; **`identifier(` … `)`** (balanced skip inside parens).
    - Comparison operators: **`=`**, **`<>`**, **`!=`**, **`<=`**, **`>=`**, **`<`**, **`>`**.
    - **`IS [NOT] NULL`**.
    - **`IN (` … `)`** — list region is **skipped** (not per-value typing).
- Column references validated against `FROM` scope (and three-part names against the DB).
- Ends with **`;`** or end. Success does not alter the schema shape in the current model.

---

## Not supported (skipped or absent)

Statements such as **`INSERT`**, **`UPDATE`**, **`ALTER`**, **`CREATE INDEX`**, other **`CREATE`** variants, **`TRUNCATE`**, **`GRANT`**, etc. are **not** parsed structurally; the stream is advanced to the next **`;`** when they appear (unless they become first-class parsers later—**then update this file**).
