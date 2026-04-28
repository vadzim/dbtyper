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
| `DELETE`                      | Parsed; **checked** against the DB (`WHERE` is type-checked); does **not** mutate the schema object          |
| `SELECT`                      | Parsed; projection/joins and list **`:name`** params checked; does **not** mutate the DB                     |
| Anything else                 | **Skipped** to the next `;` (or end): bracket-aware forward scan (`SkipBracketedUntil`), no structured parse |

Multi-statement scripts are handled by walking the token stream (e.g. **`ApplyParsedStatements<Tokens, Db, Params>`** with **`Params`** defaulting to **`{}`**) until end or error.

### Schema shape (`JsqlDatabaseShape`)

- Each schema has **`sets`**: a map of relation name → **`JsqlTableShape`** (shared shape for base tables and views).
- Every entry has **`kind`**: **`"table"`** or **`"view"`** (only **`"table"`** is produced by the current parsers).

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
- New tables are merged with **`kind: "table"`**.

---

## `DROP SCHEMA` / `DROP TABLE`

- Optional **`IF EXISTS`** (as implemented per statement).
- Identifier / qualified name forms supported by the parser; **`;`** or end.
- **`DROP TABLE`** removes an object from **`sets`** only when its **`kind` is `"table"`**. If the name exists as a **`view`**, the statement **errors** (or with **`IF EXISTS`**, leaves the DB unchanged — no **`DROP VIEW`** parser yet).
- **`DROP SCHEMA`**: removes the whole schema entry when applicable (behavior depends on existence and `IF EXISTS`).

---

## `SELECT`

- Optional **`DISTINCT`**.
- **Select list**: `*`; **parameters** (`:name` per lexer); **`schema.table.column`**, **`alias.column`**, bare **`column`** resolved via the same **`ResolveColumnRefValue`** rules as expressions (catalog + `ScopeMap`): **unique** owning column succeeds; **zero** → error; **two or more** → ambiguous error. Optional **`AS alias`**. Comma-separated items.
- **Two-phase scalar expressions** (`+`, `-`, `*`, unary `-`, literals, `:param` in the list, and **identifier-led** expressions such as **`users.row_count + 1`**): the list is parsed into an untyped **`ScalarExprAst`** (`ParseScalarExprUntyped` in [`src/parser/parse-expression.ts`](src/parser/parse-expression.ts)) **before** `FROM`, then **`ResolveExpressionAST`** runs after **`ScopeMap`** is known (same **`MergeNumericArithmetic`**, **`LookupParam`**, **`ResolveColumnRefValue`** rules as typed scalar math). **`IN (` … `)`** stores each list operand in the AST and checks every element against the left-hand type at resolve time (same class rules as **`DELETE`** / **`WHERE`** below). Bare columns such as **`users.id`** use the same path with a **`col`** AST node (identifier chains are not resolved to catalog vs alias until the resolve pass). **`AS name` is required** for any non-**`col`** expression when the select list has **more than one** item; if the list has **exactly one** non-**`col`** expression and no **`AS`**, the output column name is **`?column?`** (PostgreSQL-style anonymous label). Optional **`AS`** remains allowed for bare **`users.id`**-style **`col`** projections. **`:param`** remains its own **`param`** raw item kind.
- **`*` must be the only** projection in the list.
- **`FROM` is required** after the select list.
- **`FROM`**: `schema.table` or `table` (default schema); optional **table alias**.
- **`JOIN`**: **`INNER JOIN`**, **`LEFT [OUTER] JOIN`**, **`JOIN`**. Each joined table must be followed by **`ON alias.column = alias.column`** (equality only; columns validated against join scope).
- Optional **`WHERE`**: parsed and **type-checked** with **`ParseWhereExpression`** (same rules as **`DELETE`** / **`UPDATE`**) over the join **`ScopeMap`**; must end with **`;`** (or end).
- **Query parameters**: every **`:name`** in the select list must appear in the optional third generic of **`ParseSqlStatement<…, Db, Params>`** (defaults to **`{}`** — then any `:name` is an error). Each binding is **`{ ts, sql }`**; if **`ts` is exactly `unknown`**, the projection errors (**no silent `unknown`**). The same **`Params`** map applies to **`INSERT`** / **`UPDATE`** value expressions and their **`WHERE`** clauses.
- Statement ends with **`;`** or end after the parsed tail.
- Output type: **`JsqlSelectStatementResult`** (`kind`, `columns`, `column_sql_types`). Passing DB value is unchanged.

---

## `DELETE`

- **`DELETE FROM`** then the same **table reference** and **optional alias** style as `SELECT`.
- Optional **`WHERE`** (parsed and **type-checked** via **`ParseExpressionAST`** then **`ResolveExpressionAST`** in [`src/parser/parse-expression.ts`](src/parser/parse-expression.ts); entry **`ParseWhereExpression`** in [`src/parser/parse-where-expression.ts`](src/parser/parse-where-expression.ts)):
    - **`NOT`**, **`AND`**, **`OR`**, parenthesized groups (inner group must already type to a boolean where required).
    - Operands: literals (`true` / `false` / **`null`** only for **`IS [NOT] NULL`** — **`= null` / `<> null` are rejected**), strings, numbers, **`:name`** parameters; qualified / unqualified column identifiers (bare name: same **unique / ambiguous / missing** rules as `SELECT` over the merged **`ScopeMap`**); parenthesized subexpressions; **`identifier(` … `)`** (balanced skip only — not a typed call).
    - Comparisons **`=`**, **`<>`**, **`!=`**, **`<=`**, **`>=`**, **`<`**, **`>`**: operands must share the **same TS class** (e.g. both `string`, both `number`, both `boolean`); mixed classes error.
    - **`BETWEEN` *low* `AND` *high*** — subject and both bounds share the same comparison class; **`NULL`** in any position is rejected.
    - **`LIKE`** / **`ILIKE`** — left operand and pattern must be **text** (`ILIKE` is case-insensitive at the type level only as a distinct operator; no pattern semantics).
    - Searched **`CASE WHEN` … `THEN` … [`WHEN` … `THEN` …]* [`ELSE` …] `END`** — each **`WHEN`** must be **`boolean`**; all **`THEN`** / **`ELSE`** results share the same comparison class (with **`NULL`** literals widening the result type); omitting **`ELSE`** yields **`T | null`** at the TypeScript level (no **`WHEN`**-value / simple **`CASE`** form yet).
    - Root **`WHERE`** expression must resolve to **`boolean`** (e.g. a bare column reference errors).
    - **`IS [NOT] NULL`**.
    - **`IN (` … `)`** — comma-separated **scalar values** are parsed and each must match the **left-hand operand’s comparison class** (same rules as **`=`** / **`<>`**); **`NULL`** literals in the list are rejected (`IS NULL` / `IS NOT NULL` instead).
- Column references use **`ResolveColumnRefValue`** (re-exported through **`EvalWhereClause`** / **`ParseWhereExpression`**; public entry in [`src/parser/parse-where-expression.ts`](src/parser/parse-where-expression.ts)). **Catalog** (`JsqlDatabaseShape`) plus **`ScopeMap`**. **`ParseSqlStatement<…, Db, Params>`** third generic supplies **`:name`** bindings for `WHERE` (default **`{}`** rejects any parameter).
- Ends with **`;`** or end. Success does not alter the schema shape in the current model.

---

## `INSERT`

- **`INSERT INTO`** qualified or default-schema **table name**, optional **table alias** before the column list, then **`(`** **column names** **`)`** **`VALUES (`** … **`)`** (one row only; multiple **`VALUES`** tuples are rejected).
- Each **`VALUES`** expression is parsed with **`ParseAddValue`** (same typed scalar subset as **`WHERE`** operands: literals, **`:param`**, unqualified / qualified column refs via **`ScopeMap`** for the target table).
- Each value is checked against the corresponding column’s **TypeScript type** in **`columns`** using the same **comparison-class** rules as **`=`**; **`NULL`** is rejected when **`column_facts`** marks the column **`not_null: true`**.
- Success third slot: **`JsqlInsertStatementResult`** (`kind`, `schema`, `table`, **`columns`** as the declared name list). Schema shape is unchanged.

---

## `UPDATE`

- **`UPDATE`** then the same **table reference** and **optional alias** style as **`DELETE`** / **`SELECT`** (default schema or **`schema.table`**).
- **`SET`** one or more assignments: **unqualified** **`column_name =`** typed scalar (same **`ParseAddValue`** rules and **`Params`** as **`INSERT`**). Each assignment is type-checked against the column.
- Optional **`WHERE`** — same **`ParseWhereExpression`** rules as **`DELETE`** over a **`ScopeMap`** that includes the updated table (alias if present).
- Success third slot: **`JsqlUpdateStatementResult`** (`kind`, `schema`, `table`, **`set_columns`**). Schema shape is unchanged.

## Typed expressions (`ParseExpressionAST` / `ResolveExpressionAST` / `EvalWhereClause`)

- [`src/parser/parse-expression.ts`](src/parser/parse-expression.ts): **`ParseExpressionAST`** builds an untyped **`ScalarExprAst`** (including **`AND` / `OR` / `NOT`**, comparisons, **`IS [NOT] NULL`**, **`IN`**, **`BETWEEN`**, **`LIKE` / `ILIKE`**, searched **`CASE`**, **`+` / `-` / `*`**, unary **`-`**, casts). **`ResolveExpressionAST<Ast, Db, Scope, Ctx>`** checks types once **`ScopeMap`** and **`ExpressionParseContext`** (**`catalogAccess`**: **`three_part`** | **`scope_only`**, **`params`**) are known.
- **`EvalWhereClause`** / **`ParseWhereExpression`** return **`[RestTokens, SqlParserError | null]`** for statement wiring (`WHERE` must resolve to **`boolean`**).

---

## Not supported (skipped or absent)

Statements such as **`ALTER`**, **`CREATE INDEX`**, other **`CREATE`** variants beyond **`TABLE`** / **`SCHEMA`**, **`TRUNCATE`**, **`GRANT`**, etc. are **not** parsed structurally; the stream is advanced to the next **`;`** when they appear (unless they become first-class parsers later—**then update this file**).
