# Error Message Checking in Migration Tests

**Date:** 2026-05-08 00:30  
**Current State:** Planning complete, ready to implement

## Overview

Add mandatory error message checking to all 74 `.error.test.ts` files. Currently, these tests use `@ts-expect-error` to suppress TypeScript errors but don't document or verify what error message is expected. This makes it difficult to understand what errors are being tested and whether error messages are correct.

## Migration Status

### ✅ Completed (Working)

None yet - starting implementation

### ❌ Incomplete (Causing Failures)

1. **Error Test Files** (74 files in `test/integration/**/*.error.test.ts`)
    - **Problem:** Tests use `@ts-expect-error` but don't verify error messages
    - **Impact:** Can't see what errors are expected, hard to debug when tests fail
    - **Proper fix needed:** Add `ExtractQueryError` helper and error message checks

## Current Test Failures

**Total errors:** 0 TypeScript compilation errors (tests pass but lack error message validation)

**Main issue:**

Tests suppress errors with `@ts-expect-error` but don't document what error is expected:

```typescript
await db.query(
	// @ts-expect-error
	`insert into users (id, age) values ('1', 'not a number') returning *;`,
)
```

No way to verify the error message is correct or meaningful.

## What Needs to Be Done

### Priority 1: Create ExtractQueryError Helper

**Goal:** Add type helper to extract error messages from queries

**Files to update:**

- `test/test-utils/error-test-utils.ts`
    - Add `ExtractQueryError<Db, Query>` type
    - Import required types from src/

**Approach:**

1. Add imports for DataBase, JsqlDatabaseShape, ApplyStatements
2. Create ExtractQueryError type that extracts SqlParserError from query
3. Export the type

**Estimated effort:** 30 minutes

### Priority 2: Update Infrastructure Tests

**Goal:** Add validation rules to enforce error message checks

**Files to update:**

- `test/infra/integration-file-naming.test.ts`
    - Replace backtick check with query variable check
    - Add query const validation
    - Add error message check validation

**Estimated effort:** 30 minutes

### Priority 3: Migrate All Error Test Files

**Goal:** Update all 74 `.error.test.ts` files with error message checks

**Files to update:**

- 11 files in `test/integration/insert/*.error.test.ts`
- 10 files in `test/integration/update/*.error.test.ts`
- 6 files in `test/integration/delete/*.error.test.ts`
- 30 files in `test/integration/select/*.error.test.ts`
- 12 files in `test/integration/ddl/*.error.test.ts`
- 3 files in `test/integration/query-stream/*.error.test.ts`
- 2 files in `test/integration/expressions/*.error.test.ts`

**Estimated effort:** 5-6 hours

## Migration Strategy

### Recommended Approach: Incremental Migration

1. **Phase 1: Infrastructure Setup**
    - Add ExtractQueryError helper type
    - Update infrastructure tests
    - Validate with 2-3 example files

2. **Phase 2: Batch Migration**
    - Migrate files in logical groups (INSERT, UPDATE, DELETE, SELECT, DDL)
    - Run tests after each batch
    - Fix any issues immediately

3. **Phase 3: Verification**
    - Run full test suite
    - Verify all 74 files have error checks
    - Update documentation

**Recommendation:** This approach minimizes risk and allows catching issues early

## Technical Challenges

### Challenge 1: Extracting Database Type from Runtime Value

**Problem:** The `db` variable is created at runtime, but we need its type for type-level operations

**Solution:**

- Use `typeof db` to capture the type
- TypeScript's type inference preserves the full database shape through the migration chain
- Works with `ExtractQueryError<typeof db, typeof query>`

### Challenge 2: Query Must Be Literal Type

**Problem:** TypeScript needs the query as a literal string type to parse it

**Solution:**

- Use `as const` assertion: `const query = \`...\` as const`
- This preserves the literal type for type-level parsing

## Testing Strategy

1. **Type tests:** Verify ExtractQueryError extracts correct error messages
2. **Infrastructure tests:** Validate all error test files follow the pattern
3. **Integration tests:** Ensure migrated tests still pass
4. **Regression tests:** Run full test suite after each batch

## Success Criteria

- [ ] ExtractQueryError helper type created in test/test-utils/error-test-utils.ts
- [ ] Infrastructure validation rules added to test/infra/integration-file-naming.test.ts
- [ ] All 74 .error.test.ts files updated with error message checks
- [ ] All tests pass: npm test succeeds
- [ ] Infrastructure tests enforce the new pattern

## Timeline Estimate

- **Priority 1 (Helper Type):** 30 minutes
- **Priority 2 (Infrastructure Tests):** 30 minutes
- **Priority 3 (Migrate Files):** 5-6 hours

**Total:** 6-7 hours of focused work

## Notes

- Pattern is similar to existing error-recovery tests which use ParseErrorneousText and CheckErrorneousResult
- ExtractQueryError works with integration tests using actual database instances
- Infrastructure tests will enforce consistency across all error test files
- Error messages should be exact matches to catch any unintended changes

## Current Workarounds (Temporary)

None - this is a new feature addition, not a workaround replacement.

## Related Files

- `test/test-utils/error-test-utils.ts` - Error testing utilities (add ExtractQueryError here)
- `test/test-utils/type-test-utils.ts` - Type testing utilities (Expect, Matches)
- `test/infra/integration-file-naming.test.ts` - Infrastructure validation (update rules here)
- `src/core/sql-database.ts` - Database types and query validation
- `src/parser/parse-sql-statement.ts` - ApplyStatements type
- `src/sql-parser-error.ts` - SqlParserError type definition

---

## Detailed TODO Checklist

### Working Rules

**IMPORTANT:** When working on this migration, follow these rules:

1. **Update checkboxes immediately** - Mark `[x]` as soon as a task is completed
2. **Update the plan as you learn** - If you discover new requirements or issues, add them to the plan
3. **Document blockers** - If stuck, add a note explaining what's blocking progress
4. **Keep progress tracking current** - Update the "Last Updated" timestamp and current phase
5. **Make plan resumable** - Any time you stop work, the plan should be clear enough to resume from where you left off
6. **Commit frequently** - Commit the updated plan document after completing each major step
7. **Run `npm test` frequently** - Run tests after completing each significant change or step to catch issues early

This ensures the plan is always up-to-date and can be resumed at any time.

---

### Phase 1: Infrastructure Setup (Priority 1)

**Goal:** Create the ExtractQueryError helper type and validate it works

#### Step 1.1: Add ExtractQueryError Helper

- [ ] Open `test/test-utils/error-test-utils.ts`
- [ ] Add imports: DataBase, JsqlDatabaseShape, ApplyStatements, EmptyExpressionParams
- [ ] Add ExtractQueryError type definition
- [ ] Export the new type
- [ ] Run `npm run typecheck:test` to verify no errors

**Code to add:**

```typescript
import type { DataBase } from "../../src/core/sql-database.ts"
import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"
import type { ApplyStatements } from "../../src/parser/parse-sql-statement.ts"
import type { EmptyExpressionParams } from "../../src/parser/parse-expression.ts"

export type ExtractQueryError<
	Db extends DataBase<any, any>,
	Query extends string,
> = Db extends DataBase<infer DbShape extends JsqlDatabaseShape, infer _ScalarTypes>
	? ApplyStatements<DbShape, Query, EmptyExpressionParams>[1] extends SqlParserError<infer Msg>
		? SqlParserError<Msg>
		: null
	: never
```

#### Step 1.2: Test with Example File

- [ ] Pick one simple test file (e.g., `test/integration/insert/insert-type-mismatch.error.test.ts`)
- [ ] Transform it to use the new pattern
- [ ] Run `npm run typecheck:test` to see if it works
- [ ] Get the actual error message from TypeScript
- [ ] Fill in the correct error message
- [ ] Verify the test passes

### Phase 2: Update Infrastructure Tests (Priority 2)

**Goal:** Add validation rules to enforce the new pattern

#### Step 2.1: Update Backtick Check

- [ ] Open `test/infra/integration-file-naming.test.ts`
- [ ] Find the check at line 110-117 (backtick check)
- [ ] Replace with new check for `@ts-expect-error` before `await db.query(query)`
- [ ] Run infrastructure tests to verify

**Code to replace:**

```typescript
await it(`the file ${file} should have @ts-expect-error right before query call`, async () => {
	const pattern = /\/[/*]\s*@ts-expect-error\s*(\n|\*\/)\s*await\s+db\.(query|stream)\(query\)/
	assert.ok(
		pattern.test(content),
		"@ts-expect-error should be immediately before 'await db.query(query)' or 'await db.stream(query)'."
	)
})
```

#### Step 2.2: Add Query Const Validation

- [ ] Add check for `const query = \`...\` as const` pattern
- [ ] Run infrastructure tests to see which files fail

**Code to add:**

```typescript
await it(`the file ${file} must define query as const`, async () => {
	const hasQueryConst = /\bconst\s+query\s*=\s*`[^`]*`\s+as\s+const/.test(content)
	assert.ok(
		hasQueryConst,
		"Error test files must define: const query = `...` as const"
	)
})
```

#### Step 2.3: Add Error Message Check Validation

- [ ] Add check for `type _errorCheck = Expect<Matches<ExtractQueryError<...` pattern
- [ ] Run infrastructure tests to see which files fail

**Code to add:**

```typescript
await it(`the file ${file} must have error message check`, async () => {
	const hasErrorCheck = /\btype\s+\w+\s*=\s*Expect<\s*Matches<\s*ExtractQueryError</.test(content)
	assert.ok(
		hasErrorCheck,
		"Error test files must include: type _errorCheck = Expect<Matches<ExtractQueryError<typeof db, typeof query>, SqlParserError<\"...\">>>"
	)
})
```

#### Step 2.4: Run Tests

- [ ] Run `npm test` to see which files fail validation
- [ ] Document the count of failing files

### Phase 3: Migrate Error Test Files (Priority 3)

**Goal:** Update all 74 `.error.test.ts` files to use the new pattern

#### Step 3.1: Migrate INSERT Tests (11 files)

- [ ] `test/integration/insert/insert-type-mismatch.error.test.ts`
- [ ] `test/integration/insert/insert-unknown-table.error.test.ts`
- [ ] `test/integration/insert/insert-unknown-column.error.test.ts`
- [ ] `test/integration/insert/insert-smoke-returning-with-invalid-column.error.test.ts`
- [ ] `test/integration/insert/insert-smoke-invalid-table-name.error.test.ts`
- [ ] `test/integration/insert/insert-smoke-invalid-column-name.error.test.ts`
- [ ] `test/integration/insert/insert-returning-unknown-column.error.test.ts`
- [ ] `test/integration/insert/insert-null-into-not-null-column.error.test.ts`
- [ ] `test/integration/insert/insert-not-null-missing-not-null-column-name.error.test.ts`
- [ ] `test/integration/insert/insert-missing-not-null-column.error.test.ts`
- [ ] `test/integration/insert/insert-enum-null-for-not-null-column.error.test.ts`
- [ ] Run `npm test` after this batch

#### Step 3.2: Migrate UPDATE Tests (10 files)

- [ ] `test/integration/update/update-where-unknown-column.error.test.ts`
- [ ] `test/integration/update/update-where-type-mismatch.error.test.ts`
- [ ] `test/integration/update/update-unknown-table.error.test.ts`
- [ ] `test/integration/update/update-unknown-column.error.test.ts`
- [ ] `test/integration/update/update-type-mismatch.error.test.ts`
- [ ] `test/integration/update/update-smoke-update-invalid-table.error.test.ts`
- [ ] `test/integration/update/update-smoke-update-invalid-column.error.test.ts`
- [ ] `test/integration/update/update-smoke-returning-with-invalid-column.error.test.ts`
- [ ] `test/integration/update/update-set-null-into-not-null-column.error.test.ts`
- [ ] `test/integration/update/update-returning-unknown-column.error.test.ts`
- [ ] `test/integration/update/update-enum-null-for-not-null-column.error.test.ts`
- [ ] Run `npm test` after this batch

#### Step 3.3: Migrate DELETE Tests (6 files)

- [ ] `test/integration/delete/delete-unknown-table.error.test.ts`
- [ ] `test/integration/delete/delete-smoke-returning-with-invalid-column.error.test.ts`
- [ ] `test/integration/delete/delete-where-unknown-column.error.test.ts`
- [ ] `test/integration/delete/delete-returning-unknown-column.error.test.ts`
- [ ] `test/integration/delete/delete-smoke-delete-from-invalid-table.error.test.ts`
- [ ] `test/integration/delete/delete-where-type-mismatch.error.test.ts`
- [ ] Run `npm test` after this batch

#### Step 3.4: Migrate SELECT Tests (30 files)

- [ ] Migrate all 30 SELECT error test files
- [ ] Run `npm test` after this batch

**Note:** This is the largest batch - consider splitting into smaller sub-batches

#### Step 3.5: Migrate DDL Tests (12 files)

- [ ] Migrate all 12 DDL error test files
- [ ] Run `npm test` after this batch

#### Step 3.6: Migrate Remaining Tests (5 files)

- [ ] Migrate query-stream tests (3 files)
- [ ] Migrate expression tests (2 files)
- [ ] Run `npm test` after this batch

### Phase 4: Final Verification

**Goal:** Ensure all tests pass and documentation is complete

#### Step 4.1: Run Full Test Suite

- [ ] Run `npm test` - should pass all tests
- [ ] Verify 0 TypeScript compilation errors
- [ ] Verify all infrastructure tests pass

#### Step 4.2: Verify Coverage

- [ ] Confirm all 74 error test files have error checks
- [ ] Confirm all files pass infrastructure validation
- [ ] Review any remaining issues

#### Step 4.3: Update Documentation

- [ ] Mark this plan document as complete
- [ ] Update completion date and summary

---

## Progress Tracking

**Started:** 2026-05-08 00:30  
**Last Updated:** 2026-05-08 00:31  
**Status:** 📋 Planning Complete - Ready for Implementation

**Current Phase:** Phase 1 - Infrastructure Setup

**Next Steps:**
1. Add ExtractQueryError helper to test/test-utils/error-test-utils.ts
2. Test with one example file
3. Update infrastructure tests

---

## Quick Reference

**Current pattern (bad):**
```typescript
await db.query(
	// @ts-expect-error
	`insert into users (id, age) values ('1', 'not a number') returning *;`,
)
```

**New pattern (good):**
```typescript
const query = `insert into users (id, age) values ('1', 'not a number') returning *;` as const

// @ts-expect-error
await db.query(query)

type _errorCheck = Expect<Matches<
	ExtractQueryError<typeof db, typeof query>,
	SqlParserError<"Column 'age' expects type 'integer' but got 'text'">
>>
```

**Files to modify:**
1. `test/test-utils/error-test-utils.ts` - Add ExtractQueryError helper
2. `test/infra/integration-file-naming.test.ts` - Update validation rules
3. All 74 `test/integration/**/*.error.test.ts` files - Migrate to new pattern
