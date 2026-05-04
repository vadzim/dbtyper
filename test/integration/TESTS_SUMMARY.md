# Integration Tests Summary

## Test Organization

Tests are organized into separate files, one test per file:

- `test/integration/insert/*.test.ts` - INSERT statement tests
- `test/integration/update/*.test.ts` - UPDATE statement tests
- `test/integration/delete/*.test.ts` - DELETE statement tests
- `test/integration/select/*.test.ts` - SELECT statement tests
- `test/integration/smoke/*.test.ts` - Basic smoke tests

## Test Status

**Total: 78 tests**

- ✅ **Passing: 16 tests** (21%)
- ⏭️ **Skipped: 62 tests** (79%)

Skipped tests use `.test.skip.ts` extension and are excluded from TypeScript compilation via `tsconfig.json`.

## Passing Tests (16)

### Smoke Tests (6)

- ✅ `smoke/01-basic-select.test.ts` - Basic SELECT validation
- ✅ `smoke/02-insert.test.ts` - Basic INSERT validation
- ✅ `smoke/03-update.test.ts` - Basic UPDATE validation
- ✅ `smoke/04-delete.test.ts` - Basic DELETE validation
- ✅ `smoke/05-joins.test.ts` - Basic JOIN validation
- ✅ `smoke/06-select-advanced.test.ts` - SELECT \*, aliases, qualified tables

### INSERT Tests (3)

- ✅ `insert/insert-unknown-table.test.ts` - Detects unknown table
- ✅ `insert/insert-unknown-column.test.ts` - Detects unknown column
- ✅ `insert/insert-returning-unknown-column.test.ts` - Detects unknown column in RETURNING

### UPDATE Tests (4)

- ✅ `update/update-unknown-table.test.ts` - Detects unknown table
- ✅ `update/update-unknown-column.test.ts` - Detects unknown column in SET
- ✅ `update/update-where-unknown-column.test.ts` - Detects unknown column in WHERE
- ✅ `update/update-returning-unknown-column.test.ts` - Detects unknown column in RETURNING

### DELETE Tests (3)

- ✅ `delete/delete-unknown-table.test.ts` - Detects unknown table
- ✅ `delete/delete-where-unknown-column.test.ts` - Detects unknown column in WHERE
- ✅ `delete/delete-returning-unknown-column.test.ts` - Detects unknown column in RETURNING

## Skipped Tests by Feature (62)

### RETURNING Clause (~15 tests)

The RETURNING clause is not yet implemented. These tests are skipped:

**INSERT:**

- ⏭️ `insert/insert-returning-all.test.skip.ts`
- ⏭️ `insert/insert-returning-specific-columns.test.skip.ts`

**UPDATE:**

- ⏭️ `update/update-returning-all.test.skip.ts`
- ⏭️ `update/update-returning-specific-columns.test.skip.ts`

**DELETE:**

- ⏭️ `delete/delete-returning-all.test.skip.ts`
- ⏭️ `delete/delete-returning-specific-columns.test.skip.ts`

### NULL Handling (~10 tests)

IS NULL / IS NOT NULL operators not working:

**INSERT:**

- ⏭️ `insert/insert-null-into-nullable-column.test.skip.ts`
- ⏭️ `insert/insert-null-into-not-null-column.test.skip.ts`
- ⏭️ `insert/insert-missing-nullable-column.test.skip.ts`
- ⏭️ `insert/insert-missing-not-null-column.test.skip.ts`

**UPDATE:**

- ⏭️ `update/update-set-null-into-nullable-column.test.skip.ts`
- ⏭️ `update/update-set-null-into-not-null-column.test.skip.ts`

**DELETE:**

- ⏭️ `delete/delete-where-is-null.test.skip.ts`
- ⏭️ `delete/delete-where-is-not-null.test.skip.ts`

**SELECT:**

- ⏭️ `select/select-where-is-null.test.skip.ts`
- ⏭️ `select/select-where-is-not-null.test.skip.ts`

### Multiple Rows/Columns (~5 tests)

- ⏭️ `insert/insert-multiple-rows.test.skip.ts` - INSERT with multiple rows
- ⏭️ `update/update-multiple-columns.test.skip.ts` - UPDATE multiple columns
- ⏭️ `update/update-single-column.test.skip.ts` - UPDATE single column

### Type Validation (~8 tests)

Type mismatch detection not working:

**INSERT:**

- ⏭️ `insert/insert-type-mismatch.test.skip.ts`
- ⏭️ `insert/insert-correct-types.test.skip.ts`

**UPDATE:**

- ⏭️ `update/update-type-mismatch.test.skip.ts`
- ⏭️ `update/update-correct-types.test.skip.ts`
- ⏭️ `update/update-where-type-mismatch.test.skip.ts`

**DELETE:**

- ⏭️ `delete/delete-where-type-mismatch.test.skip.ts`

**SELECT:**

- ⏭️ `select/select-where-type-mismatch.test.skip.ts`
- ⏭️ `select/select-join-type-mismatch.test.skip.ts`

### Complex WHERE Clauses (~8 tests)

- ⏭️ `insert/insert-with-select.test.skip.ts` - INSERT with SELECT subquery
- ⏭️ `update/update-with-complex-where.test.skip.ts` - Complex WHERE conditions
- ⏭️ `update/update-with-from.test.skip.ts` - UPDATE with FROM clause
- ⏭️ `delete/delete-with-complex-where.test.skip.ts` - Complex WHERE conditions
- ⏭️ `delete/delete-with-using.test.skip.ts` - DELETE with USING clause
- ⏭️ `select/select-where-and-or.test.skip.ts` - AND/OR operators
- ⏭️ `select/select-where-between.test.skip.ts` - BETWEEN operator
- ⏭️ `select/select-where-in.test.skip.ts` - IN operator

### Subqueries (~5 tests)

- ⏭️ `select/select-subquery-in-where.test.skip.ts` - Subquery in WHERE
- ⏭️ `select/select-subquery-exists.test.skip.ts` - EXISTS subquery
- ⏭️ `select/select-scalar-subquery.test.skip.ts` - Scalar subquery
- ⏭️ `select/select-correlated-subquery.test.skip.ts` - Correlated subquery
- ⏭️ `select/select-subquery-type-mismatch.test.skip.ts` - Type mismatch in subquery

### JOINs (~6 tests)

- ⏭️ `select/select-multiple-inner-joins.test.skip.ts` - Multiple INNER JOINs
- ⏭️ `select/select-multiple-left-joins.test.skip.ts` - Multiple LEFT JOINs
- ⏭️ `select/select-cross-join.test.skip.ts` - CROSS JOIN
- ⏭️ `select/select-self-join.test.skip.ts` - Self JOIN
- ⏭️ `select/select-mixed-joins.test.skip.ts` - Mixed JOIN types
- ⏭️ `select/select-ctein-join.test.skip.ts` - CTE in JOIN

### GROUP BY / HAVING (~4 tests)

- ⏭️ `select/select-group-by-single-column.test.skip.ts` - GROUP BY single column
- ⏭️ `select/select-group-by-multiple-columns.test.skip.ts` - GROUP BY multiple columns
- ⏭️ `select/select-having.test.skip.ts` - HAVING clause
- ⏭️ `select/select-invalid-group-by.test.skip.ts` - Invalid GROUP BY

### ORDER BY / LIMIT (~4 tests)

- ⏭️ `select/select-order-by.test.skip.ts` - ORDER BY clause
- ⏭️ `select/select-order-by-unknown-column.test.skip.ts` - Unknown column in ORDER BY
- ⏭️ `select/select-limit.test.skip.ts` - LIMIT clause
- ⏭️ `select/select-limit-offset.test.skip.ts` - LIMIT with OFFSET

### CTEs (WITH clause) (~3 tests)

- ⏭️ `select/select-simple-cte.test.skip.ts` - Simple CTE
- ⏭️ `select/select-multiple-ctes.test.skip.ts` - Multiple CTEs
- ⏭️ `select/select-cteunknown-column.test.skip.ts` - Unknown column in CTE

### Other (~4 tests)

- ⏭️ `insert/insert-with-values.test.skip.ts` - INSERT with VALUES
- ⏭️ `update/update-without-where.test.skip.ts` - UPDATE without WHERE
- ⏭️ `delete/delete-with-where.test.skip.ts` - DELETE with WHERE
- ⏭️ `delete/delete-without-where.test.skip.ts` - DELETE without WHERE
- ⏭️ `delete/delete-where-correct-types.test.skip.ts` - Correct types in WHERE

## High Priority Features to Implement

Based on test coverage, these features would unlock the most tests:

1. **RETURNING clause** (~15 tests) - Most impactful
2. **NULL handling (IS NULL / IS NOT NULL)** (~10 tests)
3. **Type validation** (~8 tests)
4. **Complex WHERE clauses** (~8 tests)
5. **JOINs** (~6 tests)
6. **Subqueries** (~5 tests)
7. **Multiple rows/columns** (~5 tests)
8. **GROUP BY / HAVING** (~4 tests)
9. **ORDER BY / LIMIT** (~4 tests)
10. **CTEs** (~3 tests)

## Running Tests

```bash
# Run all tests (skipped tests are excluded from compilation)
npm test

# Run only integration tests
node --test "test/integration/**/*.test.ts"

# Check TypeScript compilation (skipped tests excluded via tsconfig.json)
npm run typecheck
```

## Adding New Tests

1. Create a new file in the appropriate directory:
    - `test/integration/insert/<test-name>.test.ts`
    - `test/integration/update/<test-name>.test.ts`
    - `test/integration/delete/<test-name>.test.ts`
    - `test/integration/select/<test-name>.test.ts`

2. If the test is for an unimplemented feature, use `.test.skip.ts` extension

3. Follow the existing test pattern:

    ```typescript
    // Integration Test: <OPERATION>
    import { sqlMigrations } from "../../../src/core/sql-database.ts"

    const mockDriver = {
    	query: async () => ({ rows: [], rowCount: 0 }),
    }

    async function testName() {
    	const db = sqlMigrations({ driver: mockDriver })
    		.apply(`create schema public;`)
    		.apply(`create table users (id text, name text);`)
    		.database()

    	// ✅ Valid query should compile
    	const result = await db.query(`select id from users;`)

    	// ❌ Invalid query should not compile
    	const bad = await db.query(
    		// @ts-expect-error
    		`select wrong_col from users;`,
    	)
    }

    testName()
    ```

4. Run `npm test` to verify the test compiles and runs
