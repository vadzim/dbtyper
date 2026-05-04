# Integration Test Plan — Real-World Usage Testing

## Goal

Create a set of integration tests that simulate real-world library usage:

- Migrations create the database schema
- Tests verify that queries compile (or don't compile) as expected
- Each feature should have tests for **success** (query compiles) and **error** (TypeScript error in the expected place)

## Structure

```
test/
  integration/           # new folder for integration tests
    smoke/               # basic smoke tests
      01-basic-select.test.ts
      02-insert.test.ts
      03-update.test.ts
      04-delete.test.ts
      05-joins.test.ts
      06-subqueries.test.ts
      07-functions.test.ts
      08-group-by.test.ts
    edge-cases/          # detailed edge case tests
      column-not-found.test.ts
      type-mismatch.test.ts
      null-handling.test.ts
      ...
    real-world/          # real-world scenarios
      refactoring-schema.test.ts
      copy-paste-errors.test.ts
      incremental-query-building.test.ts
```

## Testing Approach

### Success Test (OK)

```typescript
// Query should compile without errors
const rows = await db.query(`SELECT id, name FROM users`)
// TypeScript infers type: Array<{ id: string; name: string }>
```

### Error Test (ERROR)

```typescript
// @ts-expect-error — expect error: column 'invalid_column' does not exist
const rows = await db.query(`SELECT invalid_column FROM users`)
```

The `@ts-expect-error` directive means:

- The next line **should** produce a TypeScript error
- If there's no error — the test fails
- If there's an error — the test passes

## Implementation Phases

### Phase 0: Plan (this document)

Write a detailed plan of all tests to implement.

### Phase 1: Smoke Tests (basic coverage)

Create minimal infrastructure:

- `test/integration/smoke/` — basic tests for each SQL operation
- One success test: `SELECT id, name FROM users` compiles
- One error test: `SELECT invalid_column FROM users` produces TypeScript error

If it works — push.

### Phase 2: Test Coverage Document

Create `test/integration/TEST_COVERAGE.md` with complete list:

- Which features to cover
- Which success scenarios
- Which error scenarios
- Priority of each test

### Phase 3: Implement Tests (without fixes)

Write all tests according to the document:

- Success tests (queries should compile)
- Error tests (with `@ts-expect-error`)
- **Don't fix** library code if tests don't pass

### Phase 4: Code Fixes

Fix library code until all tests pass:

- If success test doesn't compile — fix parser/resolver
- If error test doesn't produce error — add validation
- After each fix — `npm test` and commit

## Principles

1. **Each feature** should have at least 2 tests: success + error
2. **Real scenarios**: migrations → schema → queries (like in `examples/typed-postgres`)
3. **Isolated tests**: each test file can have its own migrations or use shared ones
4. **Documented expectations**: each `@ts-expect-error` should have a comment explaining why it's an error

## Feature Coverage (high-level)

### Basic SELECT

- [x] SELECT named columns (already in smoke tests)
- [x] SELECT with WHERE clause
- [ ] SELECT \* expansion
- [ ] SELECT with aliases
- [ ] SELECT from qualified table (schema.table)

### JOIN

- [x] INNER JOIN (already in smoke tests)
- [x] LEFT JOIN (already in smoke tests)
- [ ] Cross-schema JOIN
- [ ] Multiple JOINs
- [ ] JOIN with ambiguous columns

### WHERE

- [x] Simple conditions (=, !=, <, >) (already in smoke tests)
- [ ] AND / OR / NOT
- [ ] IN (list)
- [ ] BETWEEN
- [ ] IS NULL / IS NOT NULL

### INSERT

- [x] INSERT single row (already in smoke tests)
- [x] INSERT with RETURNING (already in smoke tests)
- [x] INSERT type mismatch (error) (already in smoke tests)
- [ ] INSERT multiple rows
- [ ] INSERT missing required column (error)

### UPDATE

- [x] UPDATE with WHERE (already in smoke tests)
- [x] UPDATE with RETURNING (already in smoke tests)
- [x] UPDATE type mismatch (error) (already in smoke tests)
- [ ] UPDATE non-existent column (error)

### DELETE

- [x] DELETE with WHERE (already in smoke tests)
- [x] DELETE with RETURNING (already in smoke tests)
- [ ] DELETE from non-existent table (error)

### Subqueries

- [ ] Scalar subquery in SELECT
- [ ] IN (SELECT ...)
- [ ] EXISTS (SELECT ...)
- [ ] Correlated subquery

### CTEs

- [ ] WITH ... SELECT
- [ ] Multiple CTEs
- [ ] CTE used in JOIN

### Functions

- [ ] Built-in functions (LOWER, COUNT, etc.)
- [ ] Custom functions (via Db.functions)
- [ ] Unknown function (error)

### GROUP BY / HAVING

- [ ] GROUP BY single column
- [ ] GROUP BY multiple columns
- [ ] HAVING with aggregate
- [ ] Invalid GROUP BY (error)

### Arrays (PostgreSQL)

- [ ] ARRAY constructor
- [ ] Array indexing
- [ ] Array operators (@>, &&)

### Error cases

- [x] Unknown column (already in smoke tests)
- [ ] Unknown table
- [ ] Type mismatch in WHERE
- [ ] Ambiguous column reference
- [ ] Invalid JOIN condition

## Next Steps

1. ✅ Write plan (this file)
2. ✅ Create basic smoke tests (SELECT, INSERT, UPDATE, DELETE, JOIN)
3. ⏳ Create detailed TEST_COVERAGE.md document
4. ⏳ Implement remaining tests
5. ⏳ Fix code until all tests pass
