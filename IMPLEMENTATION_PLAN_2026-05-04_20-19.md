# Implementation Plan: Fix db.query() to Support Non-RETURNING Statements

**Date:** 2026-05-04 20:19  
**Status:** ✅ RESOLVED — Fixed by ScalarTypes refactoring (commit a68d039)

---

## Problem Summary

### What We Discovered

**String literals are NOT the problem!** String literals (`'1'`, `'Alice'`, etc.) are fully supported and work correctly.

**The real issue:** `db.query()` expects SELECT or RETURNING, causing type errors for:

- ❌ DELETE without RETURNING → `"Error in query: Expected SELECT (or WITH … SELECT) for row typing"`
- ❌ INSERT without RETURNING → `"Error in query: Expected SELECT (or WITH … SELECT) for row typing"`
- ❌ UPDATE without RETURNING → `"Error in query: Expected SELECT (or WITH … SELECT) for row typing"`

**What works:**

- ✅ SELECT (always)
- ✅ DELETE with RETURNING
- ✅ INSERT with RETURNING
- ✅ UPDATE with RETURNING

---

## Root Cause Analysis

### Location: `src/core/sql-query.ts`

The type `RowShapeFromStatementResult` (lines 23-35) handles statement results:

```typescript
type RowShapeFromStatementResult<Res> = Res extends JsqlSelectStatementResult
	? Res["columns"]
	: Res extends JsqlInsertStatementResult
		? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
			? Ret["columns"]
			: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
		: Res extends JsqlUpdateStatementResult
			? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
				? Ret["columns"]
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
			: Res extends null
				? SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
```

**The problem:** Lines 33-34 return an error for `null`, but DELETE/INSERT/UPDATE without RETURNING return `null`.

### Why DELETE Returns `null`

From `src/parser/parse-delete.ts` (line 79):

```typescript
? [AfterSemi, Db, Returning]
```

Where `Returning` has type `JsqlSelectStatementResult | null`:

- DELETE with RETURNING → `JsqlSelectStatementResult` ✅
- DELETE without RETURNING → `null` ❌

---

## Solution

### Change Required

In `src/core/sql-query.ts`, modify `RowShapeFromStatementResult` to allow `null` and return an empty object `{}` instead of an error.

**Rationale:** DELETE/INSERT/UPDATE without RETURNING don't return rows, so the result type should be `{}` (empty object), not an error.

### Proposed Fix

```typescript
type RowShapeFromStatementResult<Res> = Res extends JsqlSelectStatementResult
	? Res["columns"]
	: Res extends JsqlInsertStatementResult
		? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
			? Ret["columns"]
			: {} // ← Changed: empty object instead of error
		: Res extends JsqlUpdateStatementResult
			? Res extends { returning: infer Ret extends JsqlSelectStatementResult }
				? Ret["columns"]
				: {} // ← Changed: empty object instead of error
			: Res extends null
				? {} // ← Changed: empty object instead of error
				: SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">
```

---

## Impact Analysis

### Tests Affected

This fix will unblock **~47 skipped tests** (60% of total):

**High Priority (~30 tests):**

- DELETE without WHERE
- INSERT with VALUES (string literals)
- UPDATE with SET (string literals)
- Type validation in WHERE/SET expressions

**Medium Priority (~10 tests):**

- IS NULL / IS NOT NULL operators
- Type validation edge cases

**Lower Priority:**

- CROSS JOIN support
- CTE (WITH clause)
- Complex subqueries

### Current Test Status

- Total: 78 tests
- Passing: 31 (40%)
- Skipped: 47 (60%)

### Expected After Fix

- Passing: ~61 tests (78%)
- Remaining: ~17 tests (22%) — blocked by other features (IS NULL, CROSS JOIN, CTE)

---

## Verification Steps

1. Apply the fix to `src/core/sql-query.ts`
2. Run `npm run typecheck` — should pass
3. Enable and run blocked tests one by one
4. Verify that:
    - DELETE without RETURNING compiles ✅
    - INSERT without RETURNING compiles ✅
    - UPDATE without RETURNING compiles ✅
    - String literals in WHERE/SET work ✅
    - All existing tests still pass ✅

---

## Additional Notes

### Test Structure Validation

All integration tests already use the correct `@ts-expect-error` format:

```typescript
const bad = await db.query(
	// @ts-expect-error
	`delete from users where invalid_column = '1';`,
)
```

✅ All `@ts-expect-error` directives are inside `db.query()` calls  
✅ Error tests use `@ts-expect-error`  
✅ Success tests do NOT use `@ts-expect-error`

### Files Modified

- `test/test-utils/package-scalar-types.ts` → `test/test-utils/parser-test-utils.ts` (renamed)
- All test imports updated to use new name
- Committed: `cadccc1` — "refactor: rename package-scalar-types to parser-test-utils"

---

## Next Steps

1. Apply the fix to `src/core/sql-query.ts`
2. Run typecheck and tests
3. Enable skipped tests one by one
4. Commit and push changes
5. Update `TESTS_SUMMARY.md` with new status

---

## Resolution

**Verified:** 2026-05-04 21:00

The issue was already resolved during the ScalarTypes refactoring (commit a68d039). Testing confirms:

```typescript
// ✅ All work without errors:
await db.query(`delete from users where id = '1';`)
await db.query(`insert into users (id, name) values ('1', 'Alice');`)
await db.query(`update users set name = 'Bob' where id = '1';`)
```

**Root cause of original issue:** The investigation was based on an outdated codebase state. The ScalarTypes parameter addition fixed the type resolution, allowing non-RETURNING statements to work correctly.

**Current test status:**
- 76/81 integration tests enabled (94%)
- All enabled tests passing ✅
- 5 tests skipped (complex features: INSERT...SELECT, UPDATE...FROM, DELETE...USING, CTE validation)

**No further action needed.**
