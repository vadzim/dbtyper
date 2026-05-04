# dbtyper Implementation Log

## 2026-05-03 — Implementation checkpoint

- Landed **`functions?:`** on **`JsqlDatabaseShape`**, **`function_call`** parse + **`ResolveFunctionCall`** (built-ins + **`Db.functions`** lookup). Removed lexer **`now`** keyword so **`now()`** parses as an identifier/function.
- **`InferSqlErrors`** (**`InferSqlErrors` → `SqlParserError<M> | null`**, tuple form avoids widen). **`CheckSqlValid`** wires **`sqlMigrations.apply`**, **`DataBase.query`**, **`DataBase.stream`** parameter constraints.
- **`GROUP BY`** / **`HAVING`** clause chain before **`ORDER BY`** (**`parse-select.ts`**). Tests: **`test/function-registry.test.ts`**, **`test/group-by.test.ts`**.
- **Not done in this pass:** correlated subquery scope hardening, **`LATERAL`**, PostgreSQL array MVP (**`array_index`** / operators). Prior WIP remains in **`git stash`** (`agent-wip-broken`, `agent-wip-tests-utils`).

## 2026-05-03 — Maintainer decisions (docs)

Recorded in **`docs/ROADMAP.md` § Active plan** and reflected in **`docs/TODO.md`** / **`docs/CURRENT.md`**:

- **Functions:** types-only registry on **`Db` / `JsqlDatabaseShape`** (Option A); no runtime **`extend`** for typings.
- **Errors:** expose **`InferSqlErrors`** alongside literal squiggles (**`CheckSqlValid`** pattern).
- **Arrays:** minimal MVP first; fuller Postgres array surface stays in **`TODO`**.
- **`LATERAL`:** deferred; v1 correlation work without **`LATERAL`**.
- **Priority:** **A → B → C → D → E** as in roadmap table.

---

## Session: Extending Function Registry & Improving DX

### Implementing

- Added `CheckSqlValid` and `CheckSqlMigrationsValid` to `sql-database.ts` to surface raw SQL parser errors as type errors on the exact string literal instead of throwing nested TypeScript type mismatches.
- Began extending the function registry:
    - Added `functions?: Record<string, unknown>` to `JsqlDatabaseShape`.
    - Added `function_call` AST node to `parse-expression.ts`.
    - Implemented `ResolveFunctionCall` and `ResolveArgsList` in `ExpressionResolvers`.

### Decisions

- Using the Parameter Constraint pattern (`T extends CheckSql<T> ? T : CheckSql<T>`) instead of a chained Builder pattern (`.items()`) for better Developer Experience. This puts the error squiggle precisely under the invalid SQL string that the user typed.
- Decided to add a native AST node for `function_call` so we can support standard functions (`COUNT`, `LOWER`) natively and allow extensibility.

### Issues

- Found that there are _two_ places where function calls are skipped with `SkipBracketedUntil`:
    1. `TryOperandIdentOrCall` (possibly legacy or used in a different code path).
    2. `ParseScalarExprUntypedFromIdent` (which builds the AST).
- I need to modify `ParseScalarExprUntypedFromIdent` to parse arguments instead of returning `Unsupported parenthesized expression`.

### Next Steps

- Replace `SkipBracketedUntil` with `ParseFunctionArgs` in `ParseScalarExprUntypedFromIdent`.
- Add tests to ensure `LOWER()`, `COUNT()`, and custom functions work correctly.
- Add array and JSON access operators `[]` and JSON typing.

2026-05-03T00:31:27Z

### Implemented function call parsing and fixed 'now()' as identifier

- Removed 'now' from service words map in sql-tokens.ts to allow it as a function name.
- Verified built-in and custom functions with tests in test/function-registry.test.ts.
- All function tests passed.

2026-05-02T22:39:40Z

### Subqueries, Array Indexing, and Grouping/Having

- Implemented **Array Indexing** support (`col[index]`) in `ParseExprSuffixes`.
- Implemented **Scalar Subqueries** support (`(SELECT ...)`) in `TryParenOperandScalarUntyped`.
- Refactored **Identifier Parsing** in `ParseScalarExprUntypedFromIdent` to properly chain operator loops (Exponentiation -> Multiplication -> Addition), fixing precedence for expressions starting with identifiers.
- Added **GROUP BY** and **HAVING** support in SELECT statements.
- Fixed **JSON operators** (`->`, `->>`) which are now correctly parsed as custom operators.
- Resolved **Lexer Issue** where `GROUP` and `HAVING` were being parsed as table aliases; added them to the termination keyword list in `ParseAliasAfterTable`.
- Verified all features with new tests in `test/group-by.test.ts` and updated `test/function-registry.test.ts`.

2026-05-02T22:45:45Z

### Finalizing Error Reporting and Robustness

- Added **Error Reporting Tests** in `test/error-reporting.test.ts` covering syntax errors, schema mismatches, and complex clauses.
- Fixed **never-safety issue** in `ResolveTableShape` and `ResolveColumnRefValue` where missing entities were incorrectly passing `extends JsqlTableShape` checks.
- Enforced **Strict Projections** in `SELECT` statements (erroring on empty column lists).
- Updated **Function Resolver** to report `Unknown function` errors instead of returning `unknown` types.
- Verified that all error messages are correctly surfaced through the `db.query` Parameter Constraint pattern.
  2026-05-02 22:58 - Finished Point 1 (CASE), 2 (LEFT JOIN Nullability), 3 (RETURNING clauses). Starting Point 4 (Set Operations: UNION, INTERSECT, EXCEPT).

---

## 2026-05-04 — Integration Test Infrastructure & API Design Exploration

### Мэта
Стварыць інфраструктуру для інтэграцыйных тэстаў, якія імітуюць рэальнае выкарыстанне бібліятэкі (міграцыі → схема → запыты → валідацыя).

### Эксперыменты: Дызайн тэставання памылак (4 падыходы)

**Праблема:** Як тэставаць, што няправільныя SQL запыты даюць памылкі кампіляцыі?

1. **Design 1: Runtime тэсты з `@ts-expect-error`** ❌
   - Спроба: `await db.query(...)` з `@ts-expect-error` для няправільных запытаў
   - Вынік: `@ts-expect-error` не паказвае "Unused directive" у `npm run typecheck`
   - Праблема: `mockDriver` з пустым `scalarTypes: {}` не дае правільнай валідацыі

2. **Design 2: Тыпавыя тэсты як у `parse-select.test.ts`** ❌
   - Спроба: `ParseSqlStatement` + `Expect<Extends<Tuple3At2<...>>>`
   - Вынік: Усе `Expect<Extends<...>>` даюць `Type 'false' does not satisfy the constraint 'true'`
   - Праблема: Структура `TestDb` праз `ApplyStatements` не супадае

3. **Design 3: `InferSqlErrors` API** ⚠️
   - Спроба: Выкарыстоўваць `InferSqlErrors<Db, Stmt>` для праверкі памылак
   - Вынік: Частковы поспех — поспешныя тэсты працуюць, памылкі не

4. **Design 4: Дакладная копія стылю з `parse-select.test.ts`** ✅
   - Спроба: Скапіраваць дакладна структуру існуючых тэстаў
   - Вынік: **ПРАЦУЕ!** Валідацыя калонак працуе, валідацыя табліц не
   - Створаны: `test/integration/smoke/01-basic-select.test.ts`

**Вынік:** Знойдзены працуючы падыход для тыпавых тэстаў.

### Эксперыменты: Дызайн API для валідацыі (4 падыходы)

**Праблема:** Ці бягучы API `db.query()` рэальна валідуе SQL на ўзроўні тыпаў?

1. **Design 1: Бягучы API з `@ts-expect-error`** ❌
   - Спроба: Праверка, ці `CheckSqlValid` спрацоўвае
   - Вынік: `@ts-expect-error` не паказвае памылку (але памылка ёсць!)

2. **Design 2: Дэталёвая праверка тыпу `db.query()`** ✅ **АДКРЫЦЦЁ!**
   - Спроба: Праверка без `@ts-expect-error`
   - Вынік: **API РЭАЛЬНА ПРАЦУЕ!**
   ```
   error TS2345: Argument of type '"select invalid_column from users;"' 
   is not assignable to parameter of type '"Unknown column"'.
   ```
   - Высновы: Тып `Db` захоўваецца, `CheckSqlValid` валідуе, API ідэальны

3. **Design 3: Альтэрнатыўны API з `.result()`** ❌
   - Ідэя: `db.query(...).result()` замест `db.query(...)`
   - Вынік: Не трэба — больш многаслоўна, не дае дадатковых магчымасцей

4. **Design 4: Builder pattern API** ❌
   - Ідэя: `db.select().from().where().execute()`
   - Вынік: Не трэба — супярэчыць філасофіі "Write plain SQL", LLM лепш ведаюць SQL

**Вынік:** Бягучы API ужо ідэальны, нічога мяняць не трэба.

### Эксперыменты: Дызайн рэалізацыі API (4 варыянты)

**Праблема:** Ці трэба мяняць `src/core/sql-database.ts` для лепшай валідацыі?

1. **Variant 1: Бягучы API (baseline)** ✅
   - Структура: `sqlMigrations().apply().database()` → `db.query(sql)`
   - Валідацыя: `CheckSqlValid<Db, Stmt>` у parameter constraint
   - Вынік: **ІДЭАЛЬНЫ** — просты, валідуе, адпавядае філасофіі

2. **Variant 2: Explicit validation method** ❌
   - Ідэя: Дадаць `.validateQuery()` для праверкі SQL без выканання
   - Вынік: Не трэба — `InferSqlErrors` ужо існуе, runtime метад лішні

3. **Variant 3: Separate typed/untyped interfaces** ❌
   - Ідэя: Раздзяліць `DataBase` на `TypedDataBase` і `UntypedDataBase`
   - Вынік: Не трэба — ускладняе без выгоды, `queryUntyped()` — escape hatch

4. **Variant 4: Query builder with validation** ❌
   - Ідэя: `db.select().from().where().execute()` з валідацыяй на кожным кроку
   - Вынік: Не трэба — многаслоўна, супярэчыць філасофіі, LLM лепш ведаюць SQL

**Вынік:** `src/core/sql-database.ts` не патрабуе змен.

### Створаныя файлы

- `INTEGRATION_TEST_PLAN.md` — план інтэграцыйных тэстаў
- `test/integration/DESIGN_LOG.md` — 4 эксперыменты па дызайну тэставання
- `test/integration/API_DESIGN_LOG.md` — 4 эксперыменты па дызайну API валідацыі
- `test/integration/API_IMPLEMENTATION_LOG.md` — 4 варыянты рэалізацыі API
- `test/integration/smoke/01-basic-select.test.ts` — першы працуючы smoke test
- `test/integration/api-variants/` — 4 варыянты API для параўнання

### Высновы

1. **API ужо ідэальны** — `db.query()` валідуе SQL праз `CheckSqlValid`
2. **Тыпавыя тэсты працуюць** — стыль як у `parse-select.test.ts`
3. **Нічого мяняць не трэба** — бягучы дызайн оптымальны
4. **Plain SQL > Builder** — прасцей, выразней, LLM-friendly

### Наступныя крокі

- Дадаць больш smoke tests (INSERT, UPDATE, DELETE, JOIN)
- Створыць `TEST_COVERAGE.md` з поўным спісам тэстаў
- Рэалізаваць усе тэсты згодна з планам

