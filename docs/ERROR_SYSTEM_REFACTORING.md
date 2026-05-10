# Error System Refactoring Proposal

**Date:** 2026-05-10  
**Status:** Proposal  
**Problem:** 157 out of 372 error codes (42%) are untestable, indicating architectural issues

## Executive Summary

The current error system has 372 error codes, but 157 (42%) cannot be tested in integration tests. This reveals over-engineering and architectural problems. This document proposes a refactoring that:

1. **Maintains all user-facing error information** (no loss of detail)
2. **Makes every error code testable** (100% coverage possible)
3. **Reduces complexity** (fewer codes, clearer architecture)
4. **Improves maintainability** (easier to add new errors)

**Target:** Reduce from 372 codes to ~200-220 testable codes while preserving all error information.

---

## Current Problems

### Problem 1: Unreachable INVALID_* Codes (40 codes)

**Issue:** These exist as defensive checks but are never reached because the type system catches errors earlier.

**Examples:**
- `INVALID_COMPARISON_OPERAND` - Type system already validates comparison operands
- `INVALID_ARITHMETIC_OPERAND` - Type system already validates arithmetic operands
- `INVALID_CAST_OPERAND` - Type system already validates cast operands
- `INVALID_LIKE_OPERAND` - Type system already validates LIKE operands

**Why this is bad:**
- Dead code in the codebase
- False sense of coverage
- Maintenance burden (updating error messages that never appear)
- Confusion for developers ("when does this error trigger?")

### Problem 2: Over-Specific Parser Recovery Codes (63 codes)

**Issue:** Parser error recovery has 63 specific codes for missing tokens/syntax, but these are secondary errors during malformed SQL recovery.

**Examples:**
- `EXPECTED_SEMICOLON_AFTER_INSERT`
- `EXPECTED_SEMICOLON_AFTER_UPDATE`
- `EXPECTED_SEMICOLON_AFTER_DELETE`
- `EXPECTED_SEMICOLON_AFTER_SELECT`
- `EXPECTED_SEMICOLON_AFTER_CREATE_TABLE`
- `EXPECTED_SEMICOLON_AFTER_ALTER_TABLE`
- `EXPECTED_SEMICOLON_AFTER_DROP_TABLE`

**Why this is bad:**
- 7 different codes for the same issue (missing semicolon)
- Cannot be reliably tested (error recovery is non-deterministic)
- Users don't benefit from this granularity
- Makes error registry bloated

### Problem 3: Lexer Error Recovery Codes (8 codes)

**Issue:** Lexer errors like `UNCLOSED_STRING_LITERAL` are generated during lexing and cannot be tested at the type-level integration test layer.

**Why this is bad:**
- Integration tests work at SQL statement level, not lexer level
- These errors need different testing approach (lexer unit tests)
- Mixed abstraction levels in error registry

### Problem 4: Context-Specific Duplicates (46+ codes)

**Issue:** Same error repeated for different contexts.

**Examples:**
- `UNKNOWN_TABLE_UPDATE` (2201)
- `UNKNOWN_TABLE_IN_UPDATE_FROM` (2202)
- `UNKNOWN_TABLE_IN_DELETE_USING` (2205)
- `UNKNOWN_TABLE_IN_SELECT_STAR` (2206)
- `UNKNOWN_SCHEMA_OR_TABLE_IN_FROM` (2208)
- `UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE` (2209)
- `UNKNOWN_SCHEMA_OR_TABLE_IN_UPDATE_FROM` (2210)
- `UNKNOWN_SCHEMA_OR_TABLE_IN_INSERT_INTO` (2211)
- `UNKNOWN_SCHEMA_OR_TABLE_IN_DELETE_FROM` (2212)

**Why this is bad:**
- 9 codes for "unknown table/schema"
- Users don't care about the specific context in the error code
- Context is already in the error message
- Maintenance burden (updating 9 codes when logic changes)

---

## Proposed Solution

### Principle: Context in Message, Not in Code

**Current approach:**
```typescript
// 9 different error codes for unknown table
errors[2201] = { id: "UNKNOWN_TABLE_UPDATE", message: "Unknown table in UPDATE" }
errors[2202] = { id: "UNKNOWN_TABLE_IN_UPDATE_FROM", message: "Unknown table in UPDATE FROM" }
errors[2205] = { id: "UNKNOWN_TABLE_IN_DELETE_USING", message: "Unknown table in DELETE USING" }
// ... 6 more
```

**Proposed approach:**
```typescript
// One error code with context in message
errors[2200] = { 
  id: "UNKNOWN_TABLE", 
  message: (context: string) => `Unknown table in ${context}`
}

// Usage:
FormatError(2200, ["UPDATE"])        // "Unknown table in UPDATE"
FormatError(2200, ["UPDATE FROM"])   // "Unknown table in UPDATE FROM"
FormatError(2200, ["DELETE USING"])  // "Unknown table in DELETE USING"
```

**Benefits:**
- Users get the same detailed error message
- Only 1 code instead of 9
- Easier to maintain
- Testable (can test with different contexts)

---

## Refactoring Plan

### Phase 1: Remove Unreachable INVALID_* Codes (40 codes → 0)

**Action:** Delete these codes from the registry and remove defensive checks from parser.

**Rationale:** If the type system already catches these, the defensive checks are dead code.

**Codes to remove:**
- 2000-2029: INVALID_* expression validation codes (30 codes)
- 2100-2106: INVALID_* statement validation codes (7 codes)
- 2113-2116: INVALID_* operator/number codes (4 codes)

**Impact:** No user-facing change (these errors never appeared anyway)

**Testing:** Verify type system still catches all these cases (it already does)

---

### Phase 2: Consolidate Parser Recovery Codes (63 codes → 10-15)

**Action:** Replace specific recovery codes with general ones + context.

#### 2.1: Consolidate "Expected Token" Errors

**Current:** 30+ codes for missing tokens
```typescript
1201: EXPECTED_SEMICOLON_AFTER_INSERT
1302: EXPECTED_SEMICOLON_AFTER_UPDATE
1401: EXPECTED_SEMICOLON_AFTER_DELETE
1105: EXPECTED_SEMICOLON_AFTER_SELECT
// ... 20+ more
```

**Proposed:** 1 code with context
```typescript
1100: EXPECTED_TOKEN
// Usage:
FormatError(1100, ["semicolon", "after INSERT"])
FormatError(1100, ["semicolon", "after UPDATE"])
FormatError(1100, ["FROM", "after SELECT list"])
```

#### 2.2: Consolidate "Expected Keyword" Errors

**Current:** 15+ codes for missing keywords
```typescript
1112: EXPECTED_ALIAS_AFTER_CTE
1115: EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE
1210: EXPECTED_CONFLICT_AFTER_ON_IN_INSERT
// ... 12+ more
```

**Proposed:** 1 code with context
```typescript
1110: EXPECTED_KEYWORD
// Usage:
FormatError(1110, ["alias", "after CTE"])
FormatError(1110, ["CONFLICT", "after ON in INSERT"])
```

#### 2.3: Consolidate "Expected Name" Errors

**Current:** 20+ codes for missing names
```typescript
1206: EXPECTED_COLUMN_NAME_IN_INSERT_COLUMN_LIST
1303: EXPECTED_COLUMN_NAME_IN_UPDATE_SET
1402: EXPECTED_TABLE_NAME_IN_DELETE_FROM
// ... 17+ more
```

**Proposed:** 2 codes with context
```typescript
1120: EXPECTED_TABLE_NAME
1130: EXPECTED_COLUMN_NAME
// Usage:
FormatError(1120, ["in DELETE FROM"])
FormatError(1130, ["in INSERT column list"])
FormatError(1130, ["in UPDATE SET"])
```

**Result:** 63 codes → 10-15 general codes with context

---

### Phase 3: Consolidate Context-Specific Duplicates (46 codes → 10-15)

**Action:** Merge codes that differ only by context.

#### 3.1: Unknown Entity Errors

**Current:** 30+ codes for unknown entities
```typescript
2201: UNKNOWN_TABLE_UPDATE
2202: UNKNOWN_TABLE_IN_UPDATE_FROM
2205: UNKNOWN_TABLE_IN_DELETE_USING
2206: UNKNOWN_TABLE_IN_SELECT_STAR
2208: UNKNOWN_SCHEMA_OR_TABLE_IN_FROM
// ... 25+ more
```

**Proposed:** 3 codes with context
```typescript
2200: UNKNOWN_TABLE
2210: UNKNOWN_SCHEMA
2220: UNKNOWN_COLUMN
// Usage:
FormatError(2200, ["users", "in UPDATE"])
FormatError(2200, ["posts", "in UPDATE FROM"])
FormatError(2210, ["myschema", "in FROM clause"])
FormatError(2220, ["name", "in SELECT list"])
```

#### 3.2: Type Compatibility Errors

**Current:** 10+ codes for type mismatches
```typescript
2505: INCOMPATIBLE_TYPES_IN_IN_SUBQUERY
2508: INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN
2606: NULL_NOT_VALID_BOOLEAN_OPERAND
2802: CANNOT_CONCATENATE_TEXT_WITH_ARRAY
// ... 6+ more
```

**Proposed:** 2-3 codes with context
```typescript
2500: TYPE_MISMATCH
2510: INVALID_OPERAND_TYPE
// Usage:
FormatError(2500, ["integer", "text", "in IN subquery"])
FormatError(2500, ["integer", "text", "in INSERT SELECT"])
FormatError(2510, ["NULL", "boolean", "in AND operator"])
```

**Result:** 46 codes → 10-15 general codes with context

---

### Phase 4: Move Lexer Errors to Separate Registry (8 codes)

**Action:** Create separate `lexerErrors` registry for lexer-level errors.

**Current:** Mixed in main error registry
```typescript
errors[1001] = { id: "UNCLOSED_QUOTED_IDENTIFIER", ... }
errors[1002] = { id: "UNCLOSED_STRING_LITERAL", ... }
```

**Proposed:** Separate registry
```typescript
// src/lexer/lexer-errors.ts
export const lexerErrors = {
  1001: { id: "UNCLOSED_QUOTED_IDENTIFIER", ... },
  1002: { id: "UNCLOSED_STRING_LITERAL", ... },
  // ... 6 more
}

// Test with lexer unit tests, not integration tests
```

**Rationale:**
- Lexer errors are different abstraction level
- Need different testing approach (lexer unit tests)
- Clearer separation of concerns

**Result:** 8 codes moved to separate registry

---

## Summary of Changes

| Category | Current | Proposed | Reduction |
|----------|---------|----------|-----------|
| Unreachable INVALID_* codes | 40 | 0 | -40 |
| Parser recovery codes | 63 | 10-15 | -48 to -53 |
| Context-specific duplicates | 46 | 10-15 | -31 to -36 |
| Lexer errors (moved) | 8 | 8* | 0 |
| Testable codes | 215 | 200-220 | -15 to +5 |
| **Total** | **372** | **220-250** | **-122 to -152** |

*Moved to separate `lexerErrors` registry

---

## Implementation Strategy

### Step 1: Audit and Categorize (1-2 days)

1. Review all 372 error codes
2. Categorize each as:
   - **Keep as-is** (unique, testable, necessary)
   - **Remove** (unreachable, dead code)
   - **Consolidate** (can be merged with context)
   - **Move** (wrong abstraction level)
3. Create detailed mapping document

### Step 2: Update Error Registry (2-3 days)

1. Add context parameter support to `FormatError`
2. Create consolidated error codes
3. Update error messages to use context
4. Keep old codes as deprecated aliases (for backward compatibility)

### Step 3: Update Parser/Resolver (3-5 days)

1. Replace specific error codes with general ones + context
2. Remove unreachable INVALID_* checks
3. Update error recovery to use consolidated codes
4. Ensure all error messages remain clear and helpful

### Step 4: Update Tests (2-3 days)

1. Update integration tests to use new error codes
2. Add lexer unit tests for lexer errors
3. Verify 100% coverage of new error codes
4. Remove tests for deleted codes

### Step 5: Documentation (1 day)

1. Update `docs/ERROR_CODES.md`
2. Add migration guide for users
3. Document new error code patterns
4. Update examples

### Step 6: Deprecation Period (1 release cycle)

1. Keep old codes as deprecated aliases
2. Log warnings when old codes are used
3. Update all internal usage to new codes
4. Remove old codes in next major version

**Total effort:** 10-15 days

---

## Benefits

### For Users

✅ **Same error information** - All context preserved in messages  
✅ **Clearer errors** - Less noise, more signal  
✅ **Better documentation** - Fewer codes to learn  
✅ **Consistent patterns** - Predictable error structure

### For Developers

✅ **100% testable** - Every error code can be tested  
✅ **Less maintenance** - Fewer codes to update  
✅ **Clearer architecture** - Proper abstraction levels  
✅ **Easier to extend** - Add new contexts without new codes  
✅ **Better coverage metrics** - Meaningful coverage numbers

### For the Project

✅ **Reduced complexity** - 40% fewer error codes  
✅ **Better code quality** - No dead code  
✅ **Improved maintainability** - Easier to understand and modify  
✅ **Professional appearance** - No "untestable" codes

---

## Migration Example

### Before (Current)

```typescript
// 9 different error codes for unknown table
if (!table) {
  if (context === "UPDATE") {
    return FormatError(2201, [tableName]) // UNKNOWN_TABLE_UPDATE
  } else if (context === "UPDATE FROM") {
    return FormatError(2202, [tableName]) // UNKNOWN_TABLE_IN_UPDATE_FROM
  } else if (context === "DELETE USING") {
    return FormatError(2205, [tableName]) // UNKNOWN_TABLE_IN_DELETE_USING
  }
  // ... 6 more cases
}

// Test coverage: 9 separate tests needed
```

### After (Proposed)

```typescript
// 1 error code with context
if (!table) {
  return FormatError(2200, [tableName, context]) // UNKNOWN_TABLE
}

// Test coverage: 1 test with multiple contexts
```

**User sees:**
- Before: `[dbt:2201] Unknown table "users" in UPDATE`
- After: `[dbt:2200] Unknown table "users" in UPDATE`

**Difference:** Only the error code number changed. Message is identical.

---

## Risks and Mitigations

### Risk 1: Breaking Changes

**Risk:** Users may depend on specific error codes

**Mitigation:**
- Keep old codes as deprecated aliases for 1 release cycle
- Provide migration guide
- Log warnings when old codes are used
- Only remove in next major version

### Risk 2: Loss of Granularity

**Risk:** Consolidated codes might lose useful information

**Mitigation:**
- Context parameter preserves all information
- Error messages remain identical
- Can add more context if needed
- Users get same level of detail

### Risk 3: Implementation Complexity

**Risk:** Refactoring might introduce bugs

**Mitigation:**
- Incremental approach (phase by phase)
- Comprehensive test coverage
- Keep old codes as aliases during transition
- Thorough code review

### Risk 4: Testing Gaps

**Risk:** New consolidated codes might be harder to test

**Mitigation:**
- Actually easier to test (one code, multiple contexts)
- Better test coverage (100% instead of 58%)
- Clear testing patterns
- Integration tests + lexer unit tests

---

## Success Criteria

✅ **Zero untestable error codes** - Every code has integration test  
✅ **100% test coverage** - All error codes covered  
✅ **No information loss** - Users get same error details  
✅ **Reduced complexity** - 40% fewer error codes  
✅ **Better maintainability** - Easier to add/modify errors  
✅ **Clear architecture** - Proper abstraction levels  
✅ **Backward compatibility** - Deprecated aliases for 1 release

---

## Conclusion

The current error system has 157 untestable codes (42%), indicating over-engineering and architectural issues. This proposal:

1. **Removes 40 unreachable codes** (dead code)
2. **Consolidates 63 parser recovery codes** into 10-15 general ones
3. **Merges 46 context-specific duplicates** into 10-15 general ones
4. **Moves 8 lexer errors** to separate registry

**Result:** 372 codes → 220-250 codes, all 100% testable, with no loss of user-facing information.

**Recommendation:** Proceed with refactoring in phases over 2-3 weeks.

---

## Next Steps

1. **Review this proposal** with team
2. **Get approval** for breaking changes
3. **Create detailed mapping** of old → new codes
4. **Start with Phase 1** (remove unreachable codes)
5. **Iterate through phases** with testing at each step
6. **Release with migration guide**

---

**Document Status:** Proposal  
**Author:** Error Code Coverage Analysis  
**Date:** 2026-05-10  
**Next Review:** TBD
