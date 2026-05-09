# Erroneous Queries Migration Summary

**Date**: 2026-05-09  
**Branch**: feature/migrate-to-format-error  
**Task**: Extract and track all erroneous queries from dev branch test suite

---

## Executive Summary

This document provides a comprehensive inventory of all erroneous SQL queries tested in the dev branch, cross-referenced with existing integration tests to identify coverage gaps during the migration to the new error format system.

### Key Findings

- **Total erroneous queries catalogued**: 115
- **Fully covered with integration tests**: ~35 (30%)
- **Partially covered**: ~25 (22%)
- **Missing integration tests**: ~55 (48%)

---

## Coverage by Test File

### ✅ Excellent Coverage (80%+)

1. **test/sql-tokens.test.ts** - 100% covered
    - All 4 invalid number formats have integration tests
    - Location: `test/integration/lexer/`

2. **test/parse-where-expression.test.ts** - ~85% covered
    - Unknown columns: Fully covered (9/9)
    - Parentheses errors: Fully covered (4/4)
    - IN clause errors: 2/3 covered
    - IS/IS NOT errors: Fully covered (2/2)
    - Unexpected tokens: Fully covered (1/1)
    - Type errors: 1/9 covered ⚠️
    - Location: `test/integration/where/`

### ⚠️ Partial Coverage (40-79%)

3. **test/parse-insert.test.ts** - ~70% covered
    - 4/7 queries have dedicated tests
    - Missing: parameter errors, multi-row arity mismatch
    - Location: `test/integration/insert/`

4. **test/parse-update.test.ts** - ~67% covered
    - 2/3 queries covered
    - Location: `test/integration/update/`

5. **test/parse-delete.test.ts** - ~50% covered
    - 2/4 queries covered
    - Missing: syntax error (missing FROM), bare column unknown
    - Location: `test/integration/delete/`

6. **test/group-by.test.ts** - ~50% covered
    - 1/4 queries fully covered
    - Others are similar variations
    - Location: `test/integration/select/`

### ❌ Poor Coverage (<40%)

7. **test/parse-select.test.ts** - ~20% covered
    - Only 7/33 queries have dedicated tests
    - Many syntax and type errors missing
    - Location: `test/integration/select/`

8. **test/parse-expression.test.ts** - ~15% covered
    - 1/6 queries covered (IS error via WHERE tests)
    - Missing: parameter errors, boolean validation, unary minus
    - Location: Mixed

9. **test/infer-sql-errors.test.ts** - ~30% covered
    - 2/6 queries covered
    - Missing: function arity, empty aggregate, parameters
    - Location: Mixed

10. **test/parse-create-table.test.ts** - 0% covered
    - All 7 DDL errors missing integration tests
    - Location: `test/integration/ddl/` (exists but no CREATE TABLE errors)

11. **test/parse-alter-table.test.ts** - 0% covered
    - All 5 ALTER TABLE errors missing integration tests
    - Location: `test/integration/ddl/` (exists but no ALTER TABLE errors)

12. **test/check-sql-valid.test.ts** - ~25% covered
    - 2/4 queries covered via other tests
    - Missing: view body errors, multi-statement errors

13. **test/parse-select-join-on.test.ts** - ~50% covered
    - 1/2 queries covered
    - Location: `test/integration/select/`

---

## High Priority Missing Tests

These are common user-facing errors that should have integration tests:

### Type Validation Errors (High Impact)

1. ✅ **DONE** `users.id = true` - Incompatible types in comparison
2. ❌ `users.id = null` - Use IS NULL instead of = null
3. ❌ `users.id in ( 1, 2 )` - Incompatible types in IN list
4. ❌ `users.name between 1 and 2` - Incompatible types in BETWEEN
5. ❌ `users.name like 1` - LIKE pattern must be text
6. ❌ `users.name like null` - NULL not allowed in LIKE

### SELECT Syntax Errors (High Impact)

7. ❌ `select 1, 2 from users;` - Scalar expression in SELECT requires AS alias
8. ❌ `select *, users.id from users;` - SELECT \* must be the only projection
9. ❌ `select users.name from users order users.name;` - Expected BY after ORDER
10. ❌ `select id from users join billing.subs as billing_sub on users.id = billing_sub.user_id;` - Ambiguous unqualified column

### Parameter Errors (Medium Impact)

11. ❌ `:n = 'x'` - Unknown query parameter
12. ❌ `select :limit, users.id from users;` - Unknown query parameter in SELECT
13. ❌ `insert into users (id, name) values (:id, :name);` - Unknown query parameter (no params)

### Boolean Logic Errors (Medium Impact)

14. ❌ `not 1` - NOT requires a boolean operand
15. ❌ `select (5 and true) as x from users;` - AND operands must be boolean
16. ❌ `select (true or 1) as x from users;` - OR operands must be boolean
17. ❌ `select (true and null) as x from users;` - NULL is not a valid boolean operand

### DDL Errors (Lower Priority but Complete Coverage Needed)

18. ❌ `create table auth.dup ( n int not null );` - Table already exists
19. ❌ `create table( id int not null );` - Expected table name
20. ❌ `alter table missing.items add column x int;` - Table does not exist
21. ❌ `alter table public.items drop column ghost;` - Column does not exist

---

## Recommendations

### Immediate Actions

1. **Create missing WHERE type error tests** (items 2-6 above)
    - These are common user errors with clear error messages
    - Should be straightforward to implement

2. **Create missing SELECT syntax tests** (items 7-10 above)
    - Critical for user experience
    - Cover common SQL mistakes

3. **Add parameter validation tests** (items 11-13 above)
    - Important for runtime query building
    - Currently no coverage

### Short-term Actions

4. **Add boolean logic tests** (items 14-17 above)
    - Less common but important for correctness
    - Good error messages needed

5. **Complete INSERT/UPDATE/DELETE coverage**
    - Add multi-row INSERT arity test
    - Add DELETE missing FROM syntax test

### Long-term Actions

6. **Add DDL error tests** (items 18-21 above)
    - Lower priority (less common in application code)
    - But needed for complete coverage

7. **Add derived table and CTE error tests**
    - More advanced SQL features
    - Important for complex queries

---

## Test File Locations

### Existing Integration Test Directories

- `test/integration/lexer/` - Tokenization errors ✅ Complete
- `test/integration/where/` - WHERE clause errors ✅ Mostly complete
- `test/integration/select/` - SELECT errors ⚠️ Partial
- `test/integration/insert/` - INSERT errors ⚠️ Partial
- `test/integration/update/` - UPDATE errors ⚠️ Partial
- `test/integration/delete/` - DELETE errors ⚠️ Partial
- `test/integration/ddl/` - DDL errors ❌ Missing CREATE/ALTER TABLE
- `test/integration/expressions/` - Expression errors ⚠️ Minimal
- `test/integration/query-stream/` - Stream API errors ✅ Complete

### Suggested New Test Files

Based on missing coverage, consider creating:

- `test/integration/where/where-equals-null.error.test.ts`
- `test/integration/where/where-in-type-mismatch.error.test.ts`
- `test/integration/where/where-between-type-mismatch.error.test.ts`
- `test/integration/where/where-like-type-mismatch.error.test.ts`
- `test/integration/select/select-star-with-other-columns.error.test.ts`
- `test/integration/select/select-multiple-unnamed-scalars.error.test.ts`
- `test/integration/select/select-order-missing-by.error.test.ts`
- `test/integration/select/select-ambiguous-column.error.test.ts`
- `test/integration/expressions/expr-unknown-parameter.error.test.ts`
- `test/integration/expressions/expr-not-requires-boolean.error.test.ts`
- `test/integration/expressions/expr-and-requires-boolean.error.test.ts`
- `test/integration/expressions/expr-or-requires-boolean.error.test.ts`
- `test/integration/ddl/create-table-already-exists.error.test.ts`
- `test/integration/ddl/create-table-missing-name.error.test.ts`
- `test/integration/ddl/alter-table-unknown-table.error.test.ts`
- `test/integration/ddl/alter-table-unknown-column.error.test.ts`

---

## Next Steps

1. ✅ **Completed**: Extract all erroneous queries from dev branch
2. ✅ **Completed**: Create comprehensive inventory with checkboxes
3. ✅ **Completed**: Cross-reference with existing integration tests
4. ✅ **Completed**: Identify coverage gaps and prioritize

5. **TODO**: Create missing high-priority integration tests
6. **TODO**: Verify all existing integration tests pass with new error format
7. **TODO**: Update error messages to use new `formatError()` function
8. **TODO**: Run full test suite and verify no regressions

---

## Notes

- The inventory file (`.features/erroneous-queries-inventory.md`) contains the complete detailed list with checkboxes
- This summary focuses on actionable insights and recommendations
- Coverage percentages are approximate based on manual analysis
- Some "partially covered" tests may need verification to ensure they actually test the specific error case
