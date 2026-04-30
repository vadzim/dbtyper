# TODO (dbtyper)

Action items (see **`CURRENT.md`** for shipped vs planned). Phrase each line as work to do, not as a gap description.

## Documentation

- [ ] In **`README.md`**, add a **“Type-level API”** section: import path **`core/sql.ts`**, primary entry **`ParseSqlStatement<Tokens, Db, Params>`** (third generic defaults to **`{}`**), document the **`[RestTokens, Db, Result]`** triple for statements and when **`Result`** is **`SqlParserError<…>`** vs **`null`** (end).
- [ ] In **`README.md`**, either **move the `SqlCreateTable` / `SqlSchema` / `SqlDatabase` example** behind a “Legacy / alternate path” note or **replace it** with a minimal example that uses **`ParseSqlTokens`** + **`ParseSqlStatement`** + a hand-written **`JsqlDatabaseShape`** (match **`test/parse-select.test.ts`** style).
- [ ] **Diff `README.md` links** against **`core/sql.ts`** `export` list; fix any path or symbol that does not exist.

## `INSERT` / `UPDATE` language

- [x] **Implement `INSERT … ON CONFLICT … DO UPDATE` (UPSERT)** end-to-end: parse, type **`SET`** / **`WHERE`** against post-insert row shape (or documented subset), extend **`JsqlInsertStatementResult`** or add a distinct result kind, add **`test/parse-insert.test.ts`** cases.
- [x] **Implement multi-row `VALUES`**: **`VALUES (…), (…), …`**, type each row against the column list, reject arity mismatch, add tests.
- [x] **Implement `RETURNING`**: parse projection list, resolve against post-mutation row type (same rules as **`SELECT`** list where feasible), add result typing and tests.

## `ALTER TABLE`

- [x] For each supported clause in **`parse-alter-table.ts`**, ensure **`ParseAlterTable`** output **mutates `JsqlDatabaseShape`** correctly: **`ADD COLUMN`**, **`DROP COLUMN`**, **`RENAME COLUMN`**, **`ALTER COLUMN … TYPE`**, **`SET NOT NULL`**, **`DROP NOT NULL`** (and document no-ops: **`SET DEFAULT`**, **`ADD CONSTRAINT`**, skip-until-`,`/`;`\*\*).
- [x] Add **`test/parse-alter-table.test.ts`**: one **`Expect<Extends<…>>`** success per clause above (start from a small **`JsqlDatabaseShape`**), plus at least three errors (**unknown qualified table**, **unknown column** on rename/drop, **malformed** / unsupported token sequence).

## `CASE expr WHEN`

- [x] **Extend `ParseExpressionAST` / `ParseScalarExprUntyped`** to parse **`CASE expr WHEN literal THEN … [ELSE …] END`** (distinct AST shape from searched **`CASE WHEN boolean`**).
- [x] **Extend `ResolveExpressionAST`** so **`CASE expr WHEN`** compares **`expr`** to each **`WHEN`** value with the same rules as **`=`** comparison-class checks; unify **`THEN`/`ELSE`** branch types like searched **`CASE`**.
- [x] Add **`test/parse-where-expression.test.ts`** and **`test/parse-select.test.ts`** rows covering **`CASE users.id WHEN …`** (or equivalent) for success + **`WHEN`** type mismatch + missing **`ELSE`** widening.

## Subqueries, CTEs, views

- [x] **Implement scalar subquery** **`( SELECT expr )`** inside **`ParseScalarExprUntyped`** / **`ResolveExpressionAST`**: single column, **`Params`** / **`ExprParseEnv`** threading; add **`parse-select.test.ts`** / **`parse-expression.test.ts`** cases where gaps remain.
- [x] **Implement `IN ( SELECT … )`**: single-column inner **`SELECT`**, **`IN`** comparison-class rules; **`parse-expression.test.ts`** (`WHERE`) + **`parse-select.test.ts`** as needed.
- [x] **Implement `EXISTS ( SELECT … )`**: boolean result; inner **`SELECT`** uses empty inner **`FROM`** scope (no outer correlation in **`EXISTS`** body); tests in **`parse-expression.test.ts`**.
- [x] **Implement `WITH cte AS ( SELECT … ) , …`**: CTE list, forward names for main **`SELECT`**, **`ScopeMap`** merge; **`parse-select.test.ts`** success + duplicate CTE name error. **Not implemented**: CTE cycle detection as a dedicated error.
- [ ] **Implement correlated subqueries** beyond current wiring: outer **`FROM`** is visible in **`WHERE`** / some expression sites; **`SELECT`** list inner subqueries still use an empty outer scope unless extended; no **lateral** / **`SELECT`**-list correlation tests yet.
- [x] **`CREATE VIEW`**: routed in **`ParseSqlStatement`**; **`kind: "view"`** + **`columns` / `column_sql_types`** from inner **`SELECT`**; type test in **`test/apply-statements.test.ts`** (qualified view name + **`ParseQualifiedViewName`**).

## `CREATE INDEX` / other `CREATE`

- [ ] **Decide routing**: **`CREATE INDEX`** either **`ParseSkipStatement`** until **`;`** or new **`ParseCreateIndex`**; document in **`SUPPORTED-SQL.md`**.
- [ ] If parsed: merge into **`JsqlDatabaseShape`** (new optional **`indexes`** map or attached to table) or return a **`JsqlSelectStatementResult`–free** result type; add tests.
- [ ] **`CREATE` variants** beyond **`TABLE` / `SCHEMA`**: list unsupported prefixes and add one **`ParseSqlStatement`** test each that asserts **skip** behavior (**`RestTokens`** advanced, **`Db`** unchanged) where skip is intended.

## Typed built-in calls

- [ ] **Introduce a registry** (type-level map) of **SQL functions** **`name(arg, …)`** with arity + argument **`ExprAtom`** types + return **`ExprOk`**, e.g. **`lower(text) -> text`**.
- [ ] **Replace `TryOperandIdentOrCall` “balanced skip only”** for registered names with real **`ParseExpressionAST`** argument lists + **`ResolveExpressionAST`**; keep skip for unknown names or document rejection.
- [ ] Add **`test/parse-expression.test.ts`** (or **`parse-where-expression`**) for **one known function** success and **unknown function** still skipped or error per design.

## Tests — `ApplyStatements` / skip / docs

- [x] Add **`test/apply-statements.test.ts`** (or **`parse-sql-statement`** section in an existing file): **`ApplyStatements<`create table public.t (id int); select id from t;`, EmptyDb>`** (or two **`CREATE`** steps) and **`Expect<Extends<…>>`** on the final **`Db`** shape and/or **`never`** on hard error paths.
- [x] Add a type test: **`ApplyParsedStatements`** when the **first** statement returns **`SqlParserError`** in the third tuple slot — assert **iteration stops** and **`[Rest, Db, SqlParserError<…>]`** (encode in **`Expect`**).
- [x] **`ParseSqlStatement`**: **`grant select …`** still **skip**; **`create view … as select … from …`** merges a **`view`** (see **`apply-statements.test.ts`**).
- [x] Edit **`SUPPORTED-SQL.md` § Not supported**: remove or narrow the blanket **`ALTER`** line; add an **`ALTER TABLE`** subsection mirroring **`parse-alter-table.ts`** support and no-op clauses.

## Tests — `SELECT` derived tables (edge cases)

- [x] **`test/parse-select.test.ts`**: inner derived **`WHERE`** filters inner columns only; assert success projection types.
- [x] Same file: inner **`SELECT DISTINCT`** + **`FROM`** + alias; assert **`column_sql_types`**.
- [x] Same file: inner **`FROM a JOIN b ON a.id = b.id`** inside parentheses; outer references only inner alias.
- [x] Same file: sole **`FROM`** item **`(select users.id from users) u`** without **`AS`** keyword; assert **`JsqlSelectStatementResult`**.
- [x] Same file: **`left outer join (select …) q on …`** (full **`OUTER`** keyword sequence).
- [x] Same file: **`( from users ) as x`** → **`SqlParserError`** message **`Expected SELECT in derived table`** (or actual message).
- [x] Same file: **`(select users.id from users`** without closing **`)`** → expect parser error on **`)`**.
- [x] Same file: **`(select users.id) as x`** (no inner **`FROM`**) → **`Expected FROM in derived table`** (or actual).
- [x] Same file: inner list uses **`:rid`** with **`Params`** **`{ rid: { ts: string; sql: "uuid" } }`**; outer list trivial; assert success.
- [x] Same file: **`(select users.id from users) s`** where inner tries **`select outer_alias.id from users`** or **`select users.id from users where users.id = outer_alias.id`** — assert **`SqlParserError`** (**unknown** / **invalid** qualified column) proving **no outer correlation**.

## Tests — `INSERT` / `UPDATE` / `DELETE` wiring

- [x] **`test/parse-insert.test.ts`**: **`insert into public.users (id, name) values ('a','b');`** against a **`Db`** whose **`defaultSchema`** is not **`public`** (or inverse) so qualified resolution is exercised.
- [x] Same file: **`insert into users u (id, name) values ('a','b');`** if **`ParseInsert`** allows table alias — assert **`JsqlInsertStatementResult`** or document rejection with an error test.
- [x] **`test/parse-update.test.ts`**: **`update public.users set name = 'x', id = 'y' where …`** (two **`SET`** columns) success + one wrong-type **`SET`** error.
- [x] **`test/parse-delete.test.ts`** or **`parse-select.test.ts`**: **`delete from users where users.name between 'a' and 'z';`** and **`… where users.name like 'x%';`** — end-to-end **`ParseSqlStatement`**, not only **`ParseWhereExpression`**.

## Example

make example much closer to the real world. add a docker there, create several migrations as ts files, add one package script that export migrations from ts to some temporary folder and runs some migration tool you pick to run migrations; also let migrations to put some test data to the db; make another package script that run app which prints some data from the db from docker. and a package script which starts env like docker. i mean run those scripts to ensure all is ok. add a script which stops and removes docker with db. if you find some missing features in the dbtyper - implement them if they are not big, otherwise prepare a doc and ask me
