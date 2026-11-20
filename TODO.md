# TODO (dbtyper)

Action items (see **`docs/CURRENT.md`** for shipped vs planned). Phrase each line as work to do, not as a gap description.

- [ ] make it work with omniroute (SQLite is supported: `dbtyper/sqlite`)
- [ ] try to reorganize errors - use first index by id, not by numbers to be able to cclick in IDE on FormatError<E<"here_to_click">> and navigate to error
- [ ] remove Expects and replace with Matches in all the tests
- [ ] error: "Incompatible types in IN list" -> "Incompatible types in IN list <type1> and <type2>" and also check if other errors can be more informative like this.
- [ ] add integration test for "select 1;"
- [ ] fix result for .query method - it should return smth reasonable for all the queries, not only row sets or unknown.
- [ ] make better error messages - like column "..." has wrong value or table "..." does not exist

- [ ] define if task is simple and make it with fresh context and exit to preserve tokens
- [x] add a test that all the error codes are tested in .error.test-d.ts files
- [x] add infra test that checks for every error code there's at least one integration test (`test/infra/error-codes-covered.test.ts`)
- [x] fix a mess in parse select - parse select inner expression shoild be just parse select expression and then consume ")", no bunch of _ Inner _ types
- [x] fix a mess in parse select - parsing select as value should be just parse select expression and then check that number of columns is 1
- [x] in every migration test wich has @ts-expect-error directive add a way to check the text of message.
- [ ] add integration tests for constraints (including reference to the wrong column):
      create table public.profiles (
      id uuid not null,
      created_at timestamp with time zone null default now(),
      updated_at timestamp with time zone null,
      username text null,
      avatar_url text null,
      onboarding_complete boolean null default false,
      data jsonb null,
      timezone text null,
      constraint profiles_pkey primary key (id),
      constraint profiles_username_key unique (username),
      constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade,
      constraint username_length check ((char_length(username) >= 3))
      ) tablespace pg_default;

## Documentation

- [ ] In **`README.md`**, document **custom functions**: optional **`functions?: Record<string, …>`** on the typed **`JsqlDatabaseShape`** / migration **`Db`** (types-only registry; **no** runtime `extend` API for typings).
- [ ] In **`README.md`**, add a **“Type-level API”** section: the public entry **`src/index.ts`** (`sqlMigrations`, `createDriver`, `migration`); the type-level parser entry **`ParseSqlStatement<Tokens, Db, Params>`** is internal (third generic defaults to **`{}`**), document the **`[RestTokens, Db, Result]`** triple for statements and when **`Result`** is **`SqlParserError<…>`** vs **`null`** (end).
- [x] README no longer shows the `SqlCreateTable` / `SqlSchema` / `SqlDatabase` example (it shows `sqlMigrations` and the drivers)
- [ ] **Diff `README.md` links** against `src/index.ts` exports and the files they point to; fix any path or symbol that does not exist.

## `INSERT` / `UPDATE` language

- [x] **Implement `INSERT … ON CONFLICT … DO UPDATE` (UPSERT)** end-to-end: parse, type **`SET`** / **`WHERE`** against post-insert row shape (or documented subset), extend **`JsqlInsertStatementResult`** or add a distinct result kind, add **`test/integration/insert/`** cases.
- [x] **Implement multi-row `VALUES`**: **`VALUES (…), (…), …`**, type each row against the column list, reject arity mismatch, add tests.
- [x] **Implement `RETURNING`**: parse projection list, resolve against post-mutation row type (same rules as **`SELECT`** list where feasible), add result typing and tests.

## `ALTER TABLE`

- [x] For each supported clause in **`parse-alter-table.ts`**, ensure **`ParseAlterTable`** output **mutates `JsqlDatabaseShape`** correctly: **`ADD COLUMN`**, **`DROP COLUMN`**, **`RENAME COLUMN`**, **`ALTER COLUMN … TYPE`**, **`SET NOT NULL`**, **`DROP NOT NULL`** (and document no-ops: **`SET DEFAULT`**, **`ADD CONSTRAINT`**, skip-until-`,`/`;`\*\*).
- [x] Add **`test/integration/ddl/`**: one **`Expect<Extends<…>>`** success per clause above (start from a small **`JsqlDatabaseShape`**), plus at least three errors (**unknown qualified table**, **unknown column** on rename/drop, **malformed** / unsupported token sequence).

## `CASE expr WHEN`

- [x] **Extend `ParseExpressionAST` / `ParseScalarExprUntyped`** to parse **`CASE expr WHEN literal THEN … [ELSE …] END`** (distinct AST shape from searched **`CASE WHEN boolean`**).
- [x] **Extend `ResolveExpressionAST`** so **`CASE expr WHEN`** compares **`expr`** to each **`WHEN`** value with the same rules as **`=`** comparison-class checks; unify **`THEN`/`ELSE`** branch types like searched **`CASE`**.
- [x] Add **`test/integration/where/`** and **`test/integration/select/`** rows covering **`CASE users.id WHEN …`** (or equivalent) for success + **`WHEN`** type mismatch + missing **`ELSE`** widening.

## Subqueries, CTEs, views

- [x] **Implement scalar subquery** **`( SELECT expr )`** inside **`ParseScalarExprUntyped`** / **`ResolveExpressionAST`**: single column, **`Params`** / **`ExprParseEnv`** threading; add **`test/integration/select/`** / **`test/integration/expressions/`** cases where gaps remain.
- [x] **Implement `IN ( SELECT … )`**: single-column inner **`SELECT`**, **`IN`** comparison-class rules; **`test/integration/expressions/`** (`WHERE`) + **`test/integration/select/`** as needed.
- [x] **Implement `EXISTS ( SELECT … )`**: boolean result; inner **`SELECT`** uses empty inner **`FROM`** scope (no outer correlation in **`EXISTS`** body); tests in **`test/integration/expressions/`**.
- [x] **Implement `WITH cte AS ( SELECT … ) , …`**: CTE list, forward names for main **`SELECT`**, **`ScopeMap`** merge; **`test/integration/select/`** success + duplicate CTE name error. **Not implemented**: CTE cycle detection as a dedicated error.
- [ ] **Implement correlated subqueries** beyond current wiring: outer **`FROM`** visible in **`WHERE`** / expression sites as needed; extend **`SELECT`**-list inner subquery scope deliberately; add tests (**v1 excludes `LATERAL`** per **`ROADMAP.md`**).
- [ ] **`LATERAL` (deferred past v1 correlation milestone):** **`JOIN LATERAL`**, **`CROSS JOIN LATERAL`**, correlated derived tables in **`FROM`** — parse, scope (**outer row visible inside**), nullability; document in **`SUPPORTED-SQL.md`** when started.
- [x] **Implement `CREATE VIEW`**: routed in **`ParseSqlStatement`**; **`kind: "view"`** + **`columns`** from inner **`SELECT`**; type test in **`test/integration/stmt/`** (qualified view name + **`ParseQualifiedViewName`**).

## `CREATE INDEX` / other `CREATE`

- [ ] **Decide routing**: **`CREATE INDEX`** either **`ParseSkipStatement`** until **`;`** or new **`ParseCreateIndex`**; document in **`SUPPORTED-SQL.md`**.
- [ ] If parsed: merge into **`JsqlDatabaseShape`** (new optional **`indexes`** map or attached to table) or return a **`JsqlSelectStatementResult`–free** result type; add tests.
- [ ] **`CREATE` variants** beyond **`TABLE` / `SCHEMA`**: list unsupported prefixes and add one **`ParseSqlStatement`** test each that asserts **skip** behavior (**`RestTokens`** advanced, **`Db`** unchanged) where skip is intended.

## Error UX + tooling (priority **B** in **`ROADMAP.md`**)

- [ ] **`DataBase.query` / `.stream`** (and migrations **`apply`** if applicable): retain **parameter constraint** so invalid SQL resolves the first generic to **`SqlParserError`** message literals (**squiggle on the string**).
- [ ] Tune messages for common mistakes (stable string templates for **`Expect`**).

- [ ] Cross-link from **`README.md`** and **`SUPPORTED-SQL.md`** error examples.

## Function registry (**types-only**, config on \*\*`Db`)

- [ ] (**Option A**) Ensure **`functions?: …`** on **`JsqlDatabaseShape`** flows through **`sqlMigrations` → `FlattenedJsqlDatabase` → `ResolveFunctionCall`**; custom names map to **`ExprOk<…>`** return types (**no** runtime-only registration for typings).
- [ ] Maintain a **built-in catalog** (**`lower`**, **`count`**, etc.) inside **`ResolveFunctionCall`** (or an extracted map) separately from **`Db["functions"]`** merge rules.
- [ ] **Replace balanced skip** with real arg parse where **`function_call`** is produced; unify **`TryOperandIdentOrCall`** / **`ParseScalarExprUntypedFromIdent`** paths (`LOG.md`).
- [ ] A test for **one custom function** + **one unknown function** (error 3619), under **`test/integration/expressions/`**.

## `GROUP BY` / `HAVING` (priority **C** in **`ROADMAP.md`**)

- [x] Parse **`GROUP BY`** and **`HAVING`**; a column outside an aggregate that is not a key is error 3403 (SEL-27…SEL-29). Tests: **`test/integration/select/`** (`group-by`), **`test/dialects/pgt-groupby-aggregate-by-dialect.test-d.ts`**.
- [ ] `GROUP BY` an output alias (`group by d`), and a grouped primary key that covers the table's other columns (see the review in issue 175).

## PostgreSQL arrays (minimal MVP, then widen)

**MVP (do first)**

- [ ] One-dimensional literals / indexing agreed in **`SUPPORTED-SQL.md`** (`ARRAY[…]` **or** documented literal subset).
- [ ] At least **one containment or overlap operator** (**`@>`** **or** **`&&`**) typed enough for **`Expect`** tests — keep parser/resolver shallow.

**Later (explicit backlog, not MVP)**

- [ ] Multidimensional arrays, full **`ARRAY`** constructor parity, slicing **`[:]`,** full operator set (**`||`**, **`<@`**, …), **`ANY`/`ALL`** with arrays coordinated with subquery **`ANY`/`ALL`**.
- [ ] Track dialect notes in **`SUPPORTED-SQL.md`** so users see what is stubbed vs real.

## Tests — `ApplyStatements` / skip / docs

- [x] Add a test under **`test/integration/stmt/`**: **`ApplyStatements<`create table public.t (id int); select id from t;`, EmptyDb>`** (or two **`CREATE`** steps) and **`Expect<Extends<…>>`** on the final **`Db`** shape and/or **`never`** on hard error paths.
- [x] Add a type test: **`ApplyParsedStatements`** when the **first** statement returns **`SqlParserError`** in the third tuple slot — assert **iteration stops** and **`[Rest, Db, SqlParserError<…>]`** (encode in **`Expect`**).
- [x] **`ParseSqlStatement`**: **`grant select …`** still **skip**; **`create view … as select … from …`** merges a **`view`** (see **`test/integration/stmt/`**).
- [x] Edit **`SUPPORTED-SQL.md` § Not supported**: remove or narrow the blanket **`ALTER`** line; add an **`ALTER TABLE`** subsection mirroring **`parse-alter-table.ts`** support and no-op clauses.

## Tests — `SELECT` derived tables (edge cases)

- [x] **`test/integration/select/`**: inner derived **`WHERE`** filters inner columns only; assert success projection types.
- [x] Same file: inner **`SELECT DISTINCT`** + **`FROM`** + alias; assert column types.
- [x] Same file: inner **`FROM a JOIN b ON a.id = b.id`** inside parentheses; outer references only inner alias.
- [x] Same file: sole **`FROM`** item **`(select users.id from users) u`** without **`AS`** keyword; assert **`JsqlSelectStatementResult`**.
- [x] Same file: **`left outer join (select …) q on …`** (full **`OUTER`** keyword sequence).
- [x] Same file: **`( from users ) as x`** → **`SqlParserError`** message **`Expected SELECT in derived table`** (or actual message).
- [x] Same file: **`(select users.id from users`** without closing **`)`** → expect parser error on **`)`**.
- [x] Same file: **`(select users.id) as x`** (no inner **`FROM`**) → **`Expected FROM in derived table`** (or actual).
- [x] Same file: inner list uses **`:rid`** with **`Params`** **`{ rid: { sql: "uuid" } }`**; outer list trivial; assert success.
- [x] Same file: **`(select users.id from users) s`** where inner tries **`select outer_alias.id from users`** or **`select users.id from users where users.id = outer_alias.id`** — assert **`SqlParserError`** (**unknown** / **invalid** qualified column) proving **no outer correlation**.

## Tests — `INSERT` / `UPDATE` / `DELETE` wiring

- [x] **`test/integration/insert/`**: **`insert into public.users (id, name) values ('a','b');`** against a **`Db`** whose **`defaultSchema`** is not **`public`** (or inverse) so qualified resolution is exercised.
- [x] Same file: **`insert into users u (id, name) values ('a','b');`** if **`ParseInsert`** allows table alias — assert **`JsqlInsertStatementResult`** or document rejection with an error test.
- [x] **`test/integration/update/`**: **`update public.users set name = 'x', id = 'y' where …`** (two **`SET`** columns) success + one wrong-type **`SET`** error.
- [x] **`test/integration/delete/`** or **`test/integration/select/`**: **`delete from users where users.name between 'a' and 'z';`** and **`… where users.name like 'x%';`** — end-to-end **`ParseSqlStatement`**, not only **`ParseWhereExpression`**.

## Example

make example much closer to the real world. add a docker there, create several migrations as ts files, add one package script that export migrations from ts to some temporary folder and runs some migration tool you pick to run migrations; also let migrations to put some test data to the db; make another package script that run app which prints some data from the db from docker. and a package script which starts env like docker. i mean run those scripts to ensure all is ok. add a script which stops and removes docker with db. if you find some missing features in the dbtyper - implement them if they are not big, otherwise prepare a doc and ask me
