# CTE Validation Bug - Root Cause Found

## Date: 2026-05-04 22:23 UTC

## Problem

CTE column validation doesn't work. Example:

```typescript
// ❌ Should error but doesn't:
with s as (select id, name from users)
select s.invalid_column from s;

// ✅ Correctly errors:
select s.invalid_column from (select id, name from users) as s;
```

## Root Cause

Found in `src/parser/parse-select.ts`, function `ParseFromTableAfterLeadingIdent` (lines 1599-1619).

When parsing `FROM s` where `s` is a CTE name:

1. Code checks if `s` has `.` (line 1605) - NO
2. Code tries to find table `s` in default schema (line 1617) - FAILS
3. Returns error "Unknown table in FROM" (line 1619)

**Missing:** Check if `s` exists in `Scope` (CTE scope) before trying database lookup.

## Why Derived Tables Work

Derived tables use `ParseParenDerivedSelect` (line 1572), which:

1. Parses the subquery
2. Creates scope entry from subquery result
3. Adds to scope with alias

This happens **before** column validation, so scope is correct.

## Why CTEs Don't Work

CTEs are added to `CteBase` scope **before** parsing the main SELECT, but `ParseFromTableAfterLeadingIdent` doesn't check `Scope` for CTE names - it only checks the database.

## Solution

Modify `ParseFromTableAfterLeadingIdent` to:

```typescript
type ParseFromTableAfterLeadingIdent<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	A extends string,
	Scope extends ScopeMap,
> =
	PeekToken<R1> extends TokenKey<".">
		? // ... existing schema.table logic ...
		: A extends keyof Scope
			? // CTE found in scope - use it
			  ParseAliasAfterCTE<R1, A, Scope[A], Scope>
			: // Not in scope - try database
			  ResolveTableShape<Db, Db["defaultSchema"], A> extends infer Tbl extends JsqlTableShape
				? ParseAliasAfterTable<R1, Db["defaultSchema"], A, Tbl, Scope>
				: [R1, SqlParserError<"Unknown table in FROM">, ParserRefErrorThirdSentinel]
```

Need to create `ParseAliasAfterCTE` or reuse existing logic.

## Implementation Steps

1. [ ] Add CTE check in `ParseFromTableAfterLeadingIdent`
2. [ ] Handle case where CTE name is used without alias (e.g., `FROM s`)
3. [ ] Ensure scope entry is correctly passed to `ResolveSelectList`
4. [ ] Add unit tests for CTE in FROM
5. [ ] Enable skipped integration tests
6. [ ] Verify all tests pass

## Estimated Time

2-3 hours for implementation and testing.

## Files to Modify

- `src/parser/parse-select.ts` - add CTE check in `ParseFromTableAfterLeadingIdent`
- `test/parse-select.test.ts` - add unit tests
- `test/integration/select/select-cte-*.test.skip.ts` - enable tests

## Notes

This is a critical bug that blocks CTE usage. Once fixed, CTE validation will work correctly and match derived table behavior.
