# TODO

## Static SQL typing (next)

1. **Typed `IN (...)` lists** — Validate each list element against the left-hand expression type; today the parenthesized region is skipped and the result is treated as boolean only.

2. **`CAST(... AS ...)` and Postgres `::`** — So expressions and projections match real migration/app SQL and you can define narrowing/widening rules.

3. **`INSERT` / `UPDATE` (later `UPSERT`)** — Add statement routing in `ParseSqlStatement`; check row/column shapes against the catalog (required columns, nullability, visible FK targets).

implement insert/update queries, we already have typed where. those quries should check types of what is inserted. support of parameters.

4. **`ALTER TABLE`** — Type-level schema patches (add/drop column, types, nullability, constraints). Early on, treating `DEFAULT` and similar as no-op at the type level is fine.

5. **Richer predicates and expressions** — e.g. `BETWEEN`, `LIKE` / `ILIKE`, `CASE`, and typed known builtins; reduce reliance on `identifier(`…`)` as “balanced skip only” where you want real static checks.

6. **`SELECT ... WHERE`** — Align filter typing with the same boolean expression core and `ScopeMap` as `DELETE` (if anything is still missing vs `WHERE` on delete).

7. **Subqueries, CTEs, `CREATE VIEW`** — High type cost; a plausible sequence is scalar subqueries → `FROM` subselect → `WITH` → view row types.
