# dbtyper Implementation Log

## 2026-05-07 — Expression Parser Refactoring

**Completed refactoring of subquery parsing to eliminate duplicate code:**

- **Added `OuterScope` parameter to `ParseSelectExpression`** to support correlated subqueries (previously hardcoded to `{}`).
- **Created three helper types** in `parse-select.ts`:
    - `ConsumeClosingParen` - consumes `)` after subquery
    - `ValidateSingleColumn` - validates scalar subquery has exactly 1 column
    - `ParseAliasAfterDerived` - parses alias after derived table
- **Refactored three entry points** to use `ParseSelectExpression` + helpers:
    - `ParseParenScalarSelect` - scalar subqueries (exactly one column)
    - `ParseParenEnclosedSelect` - multi-column subqueries (`EXISTS`, `IN (SELECT)`, CTEs)
    - `ParseParenDerivedSelect` - derived tables in `FROM` clause
- **Removed 181 lines of duplicate code** (~7% reduction):
    - Deleted 9 `ParseInner*` types that duplicated SELECT parsing logic
    - Deleted 2 `ReadClosingParen*` helper types (replaced by new helpers)
    - File reduced from 2333 to 2152 lines

**Benefits:**

- Single SELECT parsing path (`ParseSelectExpression`) for all contexts
- Clearer separation of concerns (parse → validate → consume `)` → parse alias)
- Easier to maintain and extend
- All 2238 tests passing, including correlated subqueries

**Completed TODO items:**

- ✅ "fix a mess in parse select - parse select inner expression should be just parse select expression and then consume ')', no bunch of _Inner_ types"
- ✅ "fix a mess in parse select - parsing select as value should be just parse select expression and then check that number of columns is 1"

---

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

### Goal

Create integration test infrastructure that mimics real-world library usage (migrations → schema → queries → validation).

### Experiments: Error Testing Design (4 approaches)

**Problem:** How to test that invalid SQL queries produce compilation errors?

1. **Design 1: Runtime tests with `@ts-expect-error`** ❌
    - Attempt: `await db.query(...)` with `@ts-expect-error` for invalid queries
    - Result: `@ts-expect-error` doesn't show "Unused directive" in `npm run typecheck`
    - Issue: `mockDriver` with empty `scalarTypes: {}` doesn't provide proper validation

2. **Design 2: Type-level tests like `parse-select.test.ts`** ❌
    - Attempt: `ParseSqlStatement` + `Expect<Extends<Tuple3At2<...>>>`
    - Result: All `Expect<Extends<...>>` give `Type 'false' does not satisfy the constraint 'true'`
    - Issue: `TestDb` structure via `ApplyStatements` doesn't match

3. **Design 3: `InferSqlErrors` API** ⚠️
    - Attempt: Use `InferSqlErrors<Db, Stmt>` to check for errors
    - Result: Partial success — success tests work, error tests don't

4. **Design 4: Exact copy of `parse-select.test.ts` style** ✅
    - Attempt: Copy exact structure of existing tests
    - Result: **WORKS!** Column validation works, table validation doesn't
    - Created: `test/integration/smoke/01-basic-select.test.ts`

**Result:** Found working approach for type-level tests.

### Experiments: API Validation Design (4 approaches)

**Problem:** Does current `db.query()` API actually validate SQL at type level?

1. **Design 1: Current API with `@ts-expect-error`** ❌
    - Attempt: Check if `CheckSqlValid` works
    - Result: `@ts-expect-error` doesn't show error (but error exists!)

2. **Design 2: Detailed type check of `db.query()`** ✅ **DISCOVERY!**
    - Attempt: Check without `@ts-expect-error`
    - Result: **API ACTUALLY WORKS!**

    ```
    error TS2345: Argument of type '"select invalid_column from users;"'
    is not assignable to parameter of type '"Unknown column"'.
    ```

    - Conclusion: `Db` type is preserved, `CheckSqlValid` validates, API is ideal

3. **Design 3: Alternative API with `.result()`** ❌
    - Idea: `db.query(...).result()` instead of `db.query(...)`
    - Result: Not needed — more verbose, no additional benefits

4. **Design 4: Builder pattern API** ❌
    - Idea: `db.select().from().where().execute()`
    - Result: Not needed — contradicts "Write plain SQL" philosophy, LLMs know SQL better

**Result:** Current API is already ideal, no changes needed.

### Experiments: API Implementation Design (4 variants)

**Problem:** Should we change `src/core/sql-database.ts` for better validation?

1. **Variant 1: Current API (baseline)** ✅
    - Structure: `sqlMigrations().apply().database()` → `db.query(sql)`
    - Validation: `CheckSqlValid<Db, Stmt>` in parameter constraint
    - Result: **IDEAL** — simple, validates, follows philosophy

2. **Variant 2: Explicit validation method** ❌
    - Idea: Add `.validateQuery()` to check SQL without execution
    - Result: Not needed — `InferSqlErrors` already exists, runtime method is redundant

3. **Variant 3: Separate typed/untyped interfaces** ❌
    - Idea: Split `DataBase` into `TypedDataBase` and `UntypedDataBase`
    - Result: Not needed — adds complexity without benefit, `queryUntyped()` is escape hatch

4. **Variant 4: Query builder with validation** ❌
    - Idea: `db.select().from().where().execute()` with validation at each step
    - Result: Not needed — verbose, contradicts philosophy, LLMs know SQL better

**Result:** `src/core/sql-database.ts` requires no changes.

### Created Files

- `INTEGRATION_TEST_PLAN.md` — integration test plan
- `test/integration/DESIGN_LOG.md` — 4 experiments on testing design
- `test/integration/API_DESIGN_LOG.md` — 4 experiments on API validation design
- `test/integration/API_IMPLEMENTATION_LOG.md` — 4 API implementation variants
- `test/integration/smoke/01-basic-select.test.ts` — first working smoke test
- `test/integration/api-variants/` — 4 API variants for comparison

### Conclusions

1. **API is already ideal** — `db.query()` validates SQL via `CheckSqlValid`
2. **Type-level tests work** — style like `parse-select.test.ts`
3. **No changes needed** — current design is optimal
4. **Plain SQL > Builder** — simpler, clearer, LLM-friendly

### Next Steps

- Add more smoke tests (INSERT, UPDATE, DELETE, JOIN)
- Create `TEST_COVERAGE.md` with complete test list
- Implement all tests according to plan
