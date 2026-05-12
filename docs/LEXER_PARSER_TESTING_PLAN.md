# Lexer/Parser Unit Testing Plan

**Date:** 2026-05-10  
**Status:** Proposal  
**Goal:** Test the 93 "untestable" error codes that require lexer/parser unit tests

## Problem Statement

Currently, 93 error codes (35% of active codes) are marked as "untestable" in integration tests. However, these codes ARE used in the codebase - they're just not testable with the current type-level integration test approach.

**Why they're untestable at type-level:**

- They're triggered by **malformed SQL** (syntax errors)
- Type-level tests work on **well-formed SQL strings**
- TypeScript can't parse malformed SQL at compile-time

**The solution:** Create runtime lexer/parser unit tests

---

## Current State

**Total error codes:** 265 active codes

- **Testable (integration tests):** 172 codes (65%)
- **Untestable (need lexer/parser tests):** 93 codes (35%)

**Breakdown of 93 untestable codes:**

### Category 1: Lexer Errors (8 codes)

Generated during tokenization:

- 1001 UNCLOSED_QUOTED_IDENTIFIER
- 1002 UNCLOSED_STRING_LITERAL
- 1003 UNCLOSED_TAGGED_STRING
- 1004 WRONG_STRING_TAG
- 1005 UNBALANCED_PARENTHESES
- 1006 TOKEN_NOT_FOUND
- 1008 CLOSING_BRACKET_NOT_FOUND
- 1009 UNMATCHED_CLOSING_BRACKET

### Category 2: Parser Recovery - SELECT (10 codes)

Error recovery during SELECT parsing:

- 1101 EXPECTED_SELECT_IN_SUBQUERY
- 1103 EXPECTED_SELECT_IN_EXISTS_SUBQUERY
- 1104 EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW
- 1105 EXPECTED_SEMICOLON (consolidated)
- 1112 EXPECTED_ALIAS_AFTER_CTE
- 1115 EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE
- 1120 EXPECTED_TABLE_NAME (consolidated)
- And others...

### Category 3: Parser Recovery - INSERT (17 codes)

Error recovery during INSERT parsing

### Category 4: Parser Recovery - UPDATE (8 codes)

Error recovery during UPDATE parsing

### Category 5: Parser Recovery - DELETE (5 codes)

Error recovery during DELETE parsing

### Category 6: Parser Recovery - DDL (28 codes)

Error recovery during CREATE/ALTER/DROP parsing

### Category 7: Other (17 codes)

Various semantic and validation errors

---

## Proposed Solution

### Approach: Runtime Lexer/Parser Unit Tests

Create a new test suite that:

1. Runs the lexer/parser at **runtime** (not type-level)
2. Tests **malformed SQL** strings
3. Verifies the correct error codes are returned

### Test Structure

```typescript
// test/unit/lexer-errors.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { ParseSqlTokens } from "../../src/lexer/sql-tokens.ts"

describe("Lexer Error Codes", () => {
	it("should return UNCLOSED_STRING_LITERAL for unclosed string", () => {
		const sql = `SELECT 'unclosed FROM users` as const
		const result = ParseSqlTokens<typeof sql>

		// Extract error code from result
		const errorCode = extractErrorCode(result)

		assert.strictEqual(errorCode, 1002)
	})

	it("should return UNCLOSED_QUOTED_IDENTIFIER for unclosed identifier", () => {
		const sql = `SELECT "unclosed FROM users` as const
		const result = ParseSqlTokens<typeof sql>

		const errorCode = extractErrorCode(result)

		assert.strictEqual(errorCode, 1001)
	})
})
```

### Implementation Steps

#### Phase 1: Create Test Infrastructure (2-3 hours)

1. Create `test/unit/` directory for unit tests
2. Create helper functions to extract error codes from type-level results
3. Set up test runner configuration for unit tests
4. Create example tests for 2-3 lexer errors

#### Phase 2: Test Lexer Errors (1-2 hours)

1. Create `test/unit/lexer-errors.test.ts`
2. Write tests for all 8 lexer error codes
3. Verify each error can be triggered with malformed SQL

#### Phase 3: Test Parser Recovery Errors (8-10 hours)

1. Create test files for each statement type:
    - `test/unit/parser-select-errors.test.ts`
    - `test/unit/parser-insert-errors.test.ts`
    - `test/unit/parser-update-errors.test.ts`
    - `test/unit/parser-delete-errors.test.ts`
    - `test/unit/parser-ddl-errors.test.ts`
2. Write tests for all 85 parser recovery codes
3. Use malformed SQL to trigger each error

#### Phase 4: Update Error Coverage Test (1 hour)

1. Remove codes from UNTESTABLE_ERROR_CODES as they get tested
2. Update coverage test to check both integration and unit tests
3. Verify 100% coverage

---

## Technical Challenges

### Challenge 1: Extracting Error Codes from Type-Level Results

**Problem:** The lexer/parser returns complex type-level tuples. We need to extract error codes at runtime.

**Solution:** Create a helper that inspects the type structure:

```typescript
type ExtractErrorCode<T> = T extends { __sql_parser_error_code__: infer Code } ? Code : never

function extractErrorCode<T>(result: T): number {
	// Runtime extraction logic
	if (typeof result === "object" && result !== null) {
		if ("__sql_parser_error_code__" in result) {
			return (result as any).__sql_parser_error_code__
		}
	}
	return -1
}
```

### Challenge 2: Type-Level vs Runtime Testing

**Problem:** The parser is type-level, but we need runtime tests.

**Solution:** The parser DOES run at runtime for error recovery. We can:

1. Import the parser functions
2. Call them with malformed SQL
3. Check the returned error codes

### Challenge 3: Non-Deterministic Error Recovery

**Problem:** Some parser recovery errors are non-deterministic (depends on recovery path).

**Solution:**

1. Test the most common recovery paths
2. Accept that some errors may be hard to trigger consistently
3. Mark those as "best effort" tests

---

## Benefits

### For Code Quality

- ✅ **100% error code coverage** (vs current 65%)
- ✅ **Catch regressions** in error messages
- ✅ **Verify error codes are correct** for each scenario
- ✅ **Document expected behavior** for malformed SQL

### For Maintainability

- ✅ **Clear examples** of what triggers each error
- ✅ **Easier to add new errors** (with tests)
- ✅ **Confidence in refactoring** (tests catch breaks)

### For Users

- ✅ **Better error messages** (tested and verified)
- ✅ **Consistent error codes** (no accidental changes)
- ✅ **Documented error scenarios** (tests serve as docs)

---

## Timeline Estimate

- **Phase 1:** 2-3 hours (infrastructure)
- **Phase 2:** 1-2 hours (lexer tests)
- **Phase 3:** 8-10 hours (parser tests)
- **Phase 4:** 1 hour (coverage update)

**Total:** 12-16 hours of focused work

---

## Success Criteria

- [ ] All 93 untestable codes have unit tests
- [ ] 100% error code coverage (integration + unit tests)
- [ ] All tests passing
- [ ] UNTESTABLE_ERROR_CODES list is empty (or only contains truly impossible codes)
- [ ] Documentation updated

---

## Alternative Approaches Considered

### Alternative 1: Remove All Untestable Codes

**Pros:** Simplifies codebase  
**Cons:** Loses helpful error messages for malformed SQL  
**Decision:** Rejected - error messages are valuable

### Alternative 2: Mark as "Tested Manually"

**Pros:** No work required  
**Cons:** No automated verification, can regress  
**Decision:** Rejected - want automated tests

### Alternative 3: Integration Tests with String Manipulation

**Pros:** Uses existing test infrastructure  
**Cons:** Hacky, doesn't actually test the parser  
**Decision:** Rejected - not a real solution

---

## Recommendation

**Proceed with lexer/parser unit tests** as outlined in this plan.

This is the proper solution that:

- Tests the actual code paths
- Provides 100% coverage
- Documents expected behavior
- Catches regressions

**Priority:** Medium (not urgent, but should be done for completeness)

---

## Next Steps

1. Review this plan with team
2. Get approval for the approach
3. Start with Phase 1 (infrastructure)
4. Implement incrementally (can be done over multiple sessions)
5. Update documentation as tests are added

---

**Document Status:** Proposal  
**Author:** Error System Refactoring Team  
**Date:** 2026-05-10  
**Next Review:** TBD
