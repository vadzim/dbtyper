# Integration Tests Summary

**Status**: All tests added, ready for implementation fixes

**Date**: 2026-05-04

## Overview

Added comprehensive integration tests covering all major SQL operations with edge cases. Many tests currently fail compilation - this is expected and documents the desired behavior that needs to be implemented.

## Test Files Created

### Smoke Tests (basic functionality)

- `test/integration/smoke/01-basic-select.test.ts` ✅ PASSING
- `test/integration/smoke/02-insert.test.ts` ✅ PASSING
- `test/integration/smoke/03-update.test.ts` ✅ PASSING
- `test/integration/smoke/04-delete.test.ts` ✅ PASSING
- `test/integration/smoke/05-joins.test.ts` ✅ PASSING
- `test/integration/smoke/06-select-advanced.test.ts` ✅ PASSING

### Edge Case Tests (comprehensive coverage)

- `test/integration/edge-cases/insert-edge-cases.test.ts` ❌ MANY FAILURES
- `test/integration/edge-cases/update-edge-cases.test.ts` ❌ MANY FAILURES
- `test/integration/edge-cases/delete-edge-cases.test.ts` ❌ MANY FAILURES
- `test/integration/edge-cases/select-edge-cases.test.ts` ❌ MANY FAILURES

## Test Coverage by Feature

### INSERT Tests (14 tests)

**Basic INSERT**

- ✅ INSERT with VALUES
- ❌ INSERT with SELECT
- ❌ INSERT multiple rows

**NULL Handling**

- ❌ INSERT NULL into nullable column
- ❌ INSERT NULL into NOT NULL column (should error)
- ❌ INSERT missing NOT NULL column (should error)
- ❌ INSERT missing nullable column

**Type Validation**

- ❌ INSERT type mismatch (should error)
- ❌ INSERT correct types

**Column Validation**

- ✅ INSERT unknown column (should error)
- ✅ INSERT unknown table (should error)

**RETURNING Clause**

- ❌ RETURNING \*
- ❌ RETURNING specific columns
- ✅ RETURNING unknown column (should error)

### UPDATE Tests (16 tests)

**Basic UPDATE**

- ❌ UPDATE single column
- ❌ UPDATE multiple columns
- ❌ UPDATE without WHERE
- ❌ UPDATE with complex WHERE

**NULL Handling**

- ❌ UPDATE SET NULL into nullable column
- ❌ UPDATE SET NULL into NOT NULL column (should error)

**Type Validation**

- ❌ UPDATE type mismatch (should error)
- ❌ UPDATE correct types
- ❌ UPDATE WHERE type mismatch (should error)

**Column Validation**

- ✅ UPDATE unknown column (should error)
- ✅ UPDATE WHERE unknown column (should error)
- ✅ UPDATE unknown table (should error)

**RETURNING Clause**

- ❌ RETURNING \*
- ❌ RETURNING specific columns
- ✅ RETURNING unknown column (should error)

**PostgreSQL-Specific**

- ❌ UPDATE with FROM clause

### DELETE Tests (13 tests)

**Basic DELETE**

- ❌ DELETE with WHERE
- ❌ DELETE without WHERE
- ❌ DELETE with complex WHERE

**Type Validation**

- ❌ DELETE WHERE type mismatch (should error)
- ❌ DELETE WHERE correct types

**Column Validation**

- ✅ DELETE WHERE unknown column (should error)
- ✅ DELETE unknown table (should error)

**RETURNING Clause**

- ❌ RETURNING \*
- ❌ RETURNING specific columns
- ✅ RETURNING unknown column (should error)

**PostgreSQL-Specific**

- ❌ DELETE with USING clause

**NULL Handling**

- ❌ DELETE WHERE IS NULL
- ❌ DELETE WHERE IS NOT NULL

### SELECT Tests (30 tests)

**WHERE Clause**

- ❌ WHERE type mismatch (should error)
- ❌ WHERE IS NULL
- ❌ WHERE IS NOT NULL
- ❌ WHERE IN (list)
- ❌ WHERE BETWEEN
- ❌ WHERE AND/OR

**Multiple JOINs**

- ❌ Multiple INNER JOINs
- ❌ Multiple LEFT JOINs
- ❌ Mixed INNER and LEFT JOINs
- ❌ CROSS JOIN
- ❌ Self-join
- ❌ JOIN type mismatch (should error)

**Subqueries**

- ❌ Scalar subquery in SELECT
- ❌ Subquery in WHERE with IN
- ❌ Subquery with EXISTS
- ❌ Correlated subquery
- ❌ Subquery type mismatch (should error)

**CTEs (Common Table Expressions)**

- ❌ Simple CTE
- ❌ Multiple CTEs
- ❌ CTE used in JOIN
- ❌ CTE unknown column (should error)

**Aggregation & GROUP BY**

- ❌ GROUP BY single column
- ❌ GROUP BY multiple columns
- ❌ HAVING clause
- ❌ Invalid GROUP BY (should error)

**ORDER BY & LIMIT**

- ❌ ORDER BY
- ❌ LIMIT
- ❌ LIMIT with OFFSET
- ❌ ORDER BY unknown column (should error)

## Known Issues to Fix

### High Priority (P0)

1. **RETURNING clause not working**
    - All INSERT/UPDATE/DELETE with RETURNING fail
    - Error: `"Error in query: Incompatible value type for column"`
    - Affects: ~15 tests

2. **DELETE without WHERE not working**
    - Error: `"Error in query: Expected alias or end of table in DELETE FROM"`
    - Affects: 1 test

3. **IS NULL / IS NOT NULL not working**
    - Error: `"Error in query: Expected `;` after DELETE"`
    - Affects: 2 tests

### Medium Priority (P1)

4. **INSERT with SELECT not working**
    - Error: `"Error in query: Expected VALUES after column list in INSERT"`
    - Affects: 1 test

5. **INSERT multiple rows not working**
    - Error: `"Error in query: Incompatible value type for column"`
    - Affects: 1 test

6. **WHERE IN (list) not working**
    - Error: `"Error in query: Incompatible types in IN list"`
    - Affects: 2 tests

7. **WHERE BETWEEN not working**
    - Error: `"Error in query: Incompatible types in BETWEEN"`
    - Affects: 1 test

8. **CROSS JOIN not working**
    - Error: `"Error in query: Expected alias or join clause after table"`
    - Affects: 1 test

9. **CTEs not working**
    - Error: `"Error in query: Expected `)` after subquery"`
    - Affects: 3 tests

10. **UPDATE/DELETE with FROM/USING not working**
    - Error: Various
    - Affects: 2 tests

### Low Priority (P2)

11. **Some @ts-expect-error directives unused**
    - JOIN type mismatch doesn't produce error
    - CTE unknown column doesn't produce error
    - Affects: 2 tests

## Statistics

- **Total tests**: 73
- **Passing**: 11 (15%)
- **Failing**: 62 (85%)
- **Compilation errors**: 45

## Next Steps

1. ✅ **DONE**: Add all integration tests
2. ⏳ **WAITING**: Review tests with user
3. ⏳ **TODO**: Fix implementation to make tests pass
4. ⏳ **TODO**: Update TEST_COVERAGE.md with actual status

## Notes

- All tests assume `database()` is synchronous (no `await`)
- Tests use `mockDriver` for type checking only (no actual DB)
- `@ts-expect-error` marks tests that should fail compilation
- Tests document desired behavior, not current behavior
