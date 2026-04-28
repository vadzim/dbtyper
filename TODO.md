# TODO

Forward backlog aligned with **type-safe queries against a schema** (`README.md`). See **`CURRENT.md`** for what is already done vs gaps.

1. **README + public API** — Document the real entry point (`ParseSqlStatement`, `JsqlDatabaseShape`, `Params`) alongside or instead of the older `SqlCreateTable` / `SqlSchema` sketch; keep `core/sql.ts` in sync with what is exported.

2. **`INSERT` / `UPDATE` completeness** — `UPSERT`, multi-row `VALUES`, `RETURNING` typing if desired.

3. **`ALTER TABLE`** — Type-level schema patches (add/drop column, nullability, constraints).

4. **Simple `CASE expr WHEN value THEN …`** — Complement searched `CASE WHEN …`.

5. **Subqueries, CTEs, `CREATE VIEW`** — Likely order: scalar subqueries → `FROM` subselect → `WITH` → view row types.

6. **`CREATE INDEX` / other `CREATE` variants** — Structural parse + optional schema effects where relevant.

7. **Typed function calls** — Replace or narrow `identifier(` … `)` “balanced skip only” where static arity/types are known.
