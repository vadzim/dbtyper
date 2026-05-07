# Integration Tests Summary

## Test Organization

Tests are organized into separate files, one test per file:

- `test/integration/insert/*.test.ts` - INSERT statement tests
- `test/integration/update/*.test.ts` - UPDATE statement tests
- `test/integration/delete/*.test.ts` - DELETE statement tests
- `test/integration/select/*.test.ts` - SELECT statement tests

## Test Status

**Total: 78 tests**

- ✅ **Passing: 31 tests** (40%)
- ⏭️ **Skipped: 47 tests** (60%)

Skipped tests use `.test.skip.ts` extension and are excluded from TypeScript compilation via `tsconfig.json`.

## Passing Tests (31)

### Smoke Tests (6)

- ✅ `delete/smoke-delete.test.ts` - Basic DELETE validation
- ✅ `insert/smoke-insert.test.ts` - Basic INSERT validation
- ✅ `select/smoke-basic-select.test.ts` - Basic SELECT validation
- ✅ `select/smoke-joins.test.ts` - Basic JOIN validation
- ✅ `select/smoke-select-advanced.test.ts` - SELECT \*, aliases, qualified tables
- ✅ `update/smoke-update.test.ts` - Basic UPDATE validation

### INSERT Tests (3)

- ✅ `insert/insert-unknown-table.test.ts` - Detects unknown table
- ✅ `insert/insert-unknown-column.test.ts` - Detects unknown column
- ✅ `insert/insert-returning-unknown-column.test.ts` - Detects unknown column in RETURNING

### UPDATE Tests (4)

- ✅ `update/update-unknown-table.test.ts` - Detects unknown table
- ✅ `update/update-unknown-column.test.ts` - Detects unknown column in SET
- ✅ `update/update-where-unknown-column.test.ts` - Detects unknown column in WHERE
- ✅ `update/update-returning-unknown-column.test.ts` - Detects unknown column in RETURNING

### DELETE Tests (5)

- ✅ `delete/delete-unknown-table.test.ts` - Detects unknown table
- ✅ `delete/delete-where-unknown-column.test.ts` - Detects unknown column in WHERE
- ✅ `delete/delete-returning-unknown-column.test.ts` - Detects unknown column in RETURNING
- ✅ `delete/delete-returning-all.test.ts` - RETURNING \* works
- ✅ `delete/delete-returning-specific-columns.test.ts` - RETURNING column_list works
- ✅ `delete/delete-without-where.test.ts` - DELETE without WHERE works

### SELECT Tests (13)

- ✅ `select/select-limit.test.ts` - LIMIT clause
- ✅ `select/select-limit-offset.test.ts` - LIMIT with OFFSET
- ✅ `select/select-order-by.test.ts` - ORDER BY clause
- ✅ `select/select-order-by-unknown-column.test.ts` - Detects unknown column in ORDER BY
- ✅ `select/select-group-by-single-column.test.ts` - GROUP BY single column
- ✅ `select/select-group-by-multiple-columns.test.ts` - GROUP BY multiple columns
- ✅ `select/select-having.test.ts` - HAVING clause
- ✅ `select/select-invalid-group-by.test.ts` - Detects invalid GROUP BY (non-grouped columns)
- ✅ `select/select-multiple-inner-joins.test.ts` - Multiple INNER JOINs
- ✅ `select/select-multiple-left-joins.test.ts` - Multiple LEFT JOINs
- ✅ `select/select-self-join.test.ts` - Self JOIN
- ✅ `select/select-mixed-joins.test.ts` - Mixed INNER and LEFT JOINs

## Skipped Tests by Feature (47)

### String Literals in WHERE/SET/VALUES (~30 tests)

Most tests are blocked by lack of string literal support in SQL expressions.

**Examples:**

- `WHERE id = '1'` - string literal comparison not supported
- `SET name = 'Alice'` - string literal assignment not supported
- `VALUES ('1', 'Alice')` - string literal values not supported

**Affected tests:**

- All INSERT tests with VALUES
- All UPDATE tests with SET
- Most DELETE tests with WHERE
- Most SELECT tests with WHERE

### IS NULL / IS NOT NULL (~10 tests)

IS NULL and IS NOT NULL operators not implemented.

**DELETE:**

- ⏭️ `delete/delete-where-is-null.test.skip.ts`
- ⏭️ `delete/delete-where-is-not-null.test.skip.ts`

**SELECT:**

- ⏭️ `select/select-where-is-null.test.skip.ts`
- ⏭️ `select/select-where-is-not-null.test.skip.ts`

**INSERT:**

- ⏭️ `insert/insert-null-into-nullable-column.test.skip.ts`
- ⏭️ `insert/insert-null-into-not-null-column.test.skip.ts`
- ⏭️ `insert/insert-missing-nullable-column.test.skip.ts`
- ⏭️ `insert/insert-missing-not-null-column.test.skip.ts`

**UPDATE:**

- ⏭️ `update/update-set-null-into-nullable-column.test.skip.ts`
- ⏭️ `update/update-set-null-into-not-null-column.test.skip.ts`

### CROSS JOIN (~1 test)

- ⏭️ `select/select-cross-join.test.skip.ts` - CROSS JOIN not implemented

### CTEs (WITH clause) (~3 tests)

- ⏭️ `select/select-simple-cte.test.skip.ts` - Simple CTE (blocked by IS NULL)
- ⏭️ `select/select-multiple-ctes.test.skip.ts` - Multiple CTEs
- ⏭️ `select/select-cteunknown-column.test.skip.ts` - Unknown column in CTE
- ⏭️ `select/select-ctein-join.test.skip.ts` - CTE in JOIN

### Subqueries (~5 tests)

- ⏭️ `select/select-subquery-in-where.test.skip.ts` - Subquery in WHERE (blocked by literals)
- ⏭️ `select/select-subquery-exists.test.skip.ts` - EXISTS subquery (blocked by literals)
- ⏭️ `select/select-scalar-subquery.test.skip.ts` - Scalar subquery (blocked by literals)
- ⏭️ `select/select-correlated-subquery.test.skip.ts` - Correlated subquery (blocked by literals)
- ⏭️ `select/select-subquery-type-mismatch.test.skip.ts` - Type mismatch in subquery

### Complex WHERE Clauses (~3 tests)

- ⏭️ `select/select-where-and-or.test.skip.ts` - AND/OR operators (blocked by literals)
- ⏭️ `select/select-where-between.test.skip.ts` - BETWEEN operator (blocked by literals)
- ⏭️ `select/select-where-in.test.skip.ts` - IN operator (blocked by literals)

### Type Validation (~8 tests)

Type mismatch detection blocked by string literals.

**INSERT:**

- ⏭️ `insert/insert-type-mismatch.test.skip.ts`
- ⏭️ `insert/insert-correct-types.test.skip.ts`

**UPDATE:**

- ⏭️ `update/update-type-mismatch.test.skip.ts`
- ⏭️ `update/update-correct-types.test.skip.ts`
- ⏭️ `update/update-where-type-mismatch.test.skip.ts`

**DELETE:**

- ⏭️ `delete/delete-where-type-mismatch.test.skip.ts`
- ⏭️ `delete/delete-where-correct-types.test.skip.ts`

**SELECT:**

- ⏭️ `select/select-where-type-mismatch.test.skip.ts`
- ⏭️ `select/select-join-type-mismatch.test.skip.ts`

### Multiple Rows/Columns (~5 tests)

- ⏭️ `insert/insert-multiple-rows.test.skip.ts` - INSERT with multiple rows (blocked by literals)
- ⏭️ `update/update-multiple-columns.test.skip.ts` - UPDATE multiple columns (blocked by literals)
- ⏭️ `update/update-single-column.test.skip.ts` - UPDATE single column (blocked by literals)

### Other (~5 tests)

- ⏭️ `insert/insert-with-values.test.skip.ts` - INSERT with VALUES (blocked by literals)
- ⏭️ `insert/insert-with-select.test.skip.ts` - INSERT with SELECT subquery
- ⏭️ `update/update-with-complex-where.test.skip.ts` - Complex WHERE conditions (blocked by literals)
- ⏭️ `update/update-with-from.test.skip.ts` - UPDATE with FROM clause (blocked by literals)
- ⏭️ `delete/delete-with-complex-where.test.skip.ts` - Complex WHERE conditions (blocked by literals)
- ⏭️ `delete/delete-with-using.test.skip.ts` - DELETE with USING clause

## Features Implemented in This Session

### RETURNING Clause Support

- ✅ DELETE RETURNING \* and RETURNING column_list
- ✅ UPDATE RETURNING \* and RETURNING column_list
- ✅ INSERT RETURNING already worked (was implemented earlier)

### Already Working Features (Discovered)

- ✅ SELECT LIMIT / OFFSET
- ✅ SELECT ORDER BY (with validation)
- ✅ SELECT GROUP BY / HAVING (with validation)
- ✅ Multiple JOINs (INNER, LEFT, mixed, self-join)
- ✅ DELETE without WHERE
- ✅ Column validation in ORDER BY and GROUP BY

## High Priority Features to Implement

Based on test coverage, these features would unlock the most tests:

1. **String literals in expressions** (~30 tests) - **MOST IMPACTFUL**
    - WHERE id = '1'
    - SET name = 'Alice'
    - VALUES ('1', 'Alice')

2. **IS NULL / IS NOT NULL operators** (~10 tests)
    - WHERE column IS NULL
    - WHERE column IS NOT NULL

3. **Type validation with literals** (~8 tests)
    - Requires string literals first

4. **CROSS JOIN** (~1 test)
    - SELECT ... FROM t1 CROSS JOIN t2

5. **CTEs (WITH clause)** (~3 tests)
    - Requires IS NULL for most tests

6. **Subqueries** (~5 tests)
    - Requires string literals for most tests

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
    import { mockDriver } from "../../test-utils/test-databases.ts"

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
