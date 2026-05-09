# Phase 2: Skipped Tests Analysis

**Date:** 2026-05-09 15:47  
**Total Skipped Tests:** 17 (not 76 as initially estimated)

---

## Executive Summary

Analysis of 17 skipped test files reveals 5 main categories of missing validation logic:

1. **Function Arity Validation** (5 tests) - Simple, high-impact
2. **Type Cast Validation** (2 tests) - Medium complexity
3. **Array Type Validation** (3 tests) - Medium complexity  
4. **DDL Validation** (3 tests) - Medium-high complexity
5. **SELECT Validation** (4 tests) - Varies (simple to complex)

**Key Finding:** The "76 skipped tests" mentioned in the feature document appears to be an overestimate. Only 17 `.skip.ts` files exist.

**Recommendation:** Start with function arity validation (highest impact, lowest complexity), then array operations, then type casts, then SELECT validations, and finally DDL validations.

---

## Category 1: Function Arity Validation (5 tests)

**Priority:** HIGH  
**Complexity:** SIMPLE  
**Estimated Effort:** 2-3 hours

### Tests:

1. **select-sum-empty.error.test.skip.ts**
   - Query: `select sum() from t;`
   - Error: `DbtyperError<3601, "Aggregate function sum requires an argument">`
   - Missing: Aggregate function arity check

2. **select-coalesce-empty.error.test.skip.ts**
   - Query: `select coalesce() from t;`
   - Error: `DbtyperError<3602, "Function coalesce requires at least one argument">`
   - Missing: COALESCE arity check

3. **select-lower-empty.error.test.skip.ts**
   - Query: `select lower() from t;`
   - Error: `DbtyperError<3600, "Function lower requires at least one argument">`
   - Missing: String function arity check

4. **select-now-wrong-arity.error.test.skip.ts**
   - Query: `select now(1) from u;`
   - Error: `DbtyperError` (generic - now() takes no arguments)
   - Missing: Built-in function arity check

5. **insert-uuid-without-cast.error.test.skip.ts**
   - Query: `insert into auth.users (id, ...) values ('11111111-1111-1111-1111-111111111111', ...);`
   - Error: `DbtyperError` (UUID literal requires explicit cast)
   - Missing: UUID literal validation

### Implementation Plan:

**Location:** `src/parser/parse-expression.ts` or function-specific parsers

**Approach:**
1. Add arity validation for aggregate functions (SUM, COUNT, AVG, etc.)
2. Add arity validation for COALESCE (requires ≥1 argument)
3. Add arity validation for string functions (LOWER, UPPER, etc.)
4. Add arity validation for NOW() (requires exactly 0 arguments)
5. Add UUID literal validation in INSERT VALUES

**Error Codes:** 3600, 3601, 3602 (already defined)

**Dependencies:** None - can be implemented independently

---

## Category 2: Type Cast Validation (2 tests)

**Priority:** HIGH  
**Complexity:** MEDIUM  
**Estimated Effort:** 3-4 hours

### Tests:

1. **select-cast-cannot-cast-boolean-to-integer.error.test.skip.ts**
   - Query: `select flag::integer from data;`
   - Error: `DbtyperError<2801, "Cannot cast boolean to integer">`
   - Missing: Boolean → Integer cast validation

2. **select-cast-cannot-cast-integer-to-boolean.error.test.skip.ts**
   - Query: `select id::boolean from data;`
   - Error: `DbtyperError<2800, "Cannot cast integer to boolean">`
   - Missing: Integer → Boolean cast validation

### Implementation Plan:

**Location:** `src/parser/parse-expression.ts` (type cast handling)

**Approach:**
1. Create cast compatibility matrix:
   ```typescript
   type CastCompatibility = {
     boolean: ['text'] // boolean can cast to text only
     integer: ['text', 'numeric', 'bigint'] // but NOT boolean
     text: ['integer', 'numeric', 'boolean', 'uuid', 'timestamp']
     // etc.
   }
   ```
2. Implement `ValidateCast<FromType, ToType>` type helper
3. Return error 2800/2801 for invalid casts
4. Handle explicit (::) vs implicit casts

**Error Codes:** 2800, 2801 (already defined)

**Dependencies:** None

---

## Category 3: Array Type Validation (3 tests)

**Priority:** HIGH  
**Complexity:** MEDIUM  
**Estimated Effort:** 2-3 hours

### Tests:

1. **select-any-non-array.error.test.skip.ts**
   - Query: `select * from items where id = any(priority);`
   - Error: `DbtyperError<3001, "[dbt:ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY] ANY/ALL/SOME requires an array or subquery">`
   - Missing: ANY/ALL/SOME argument type validation

2. **select-array-length-non-array.error.test.skip.ts**
   - Query: `select array_length(id, 1) as bad from items;`
   - Error: `DbtyperError<3614, "[dbt:ARRAY_LENGTH_EXPECTS_ARRAY_INTEGER] array_length expects (array, integer)">`
   - Missing: array_length() argument type validation

3. **select-unnest-non-array.error.test.skip.ts**
   - Query: `select unnest(id) as bad from items;`
   - Error: `DbtyperError<3616, "[dbt:UNNEST_EXPECTS_AN_ARRAY] unnest expects an array">`
   - Missing: unnest() argument type validation

### Implementation Plan:

**Location:** `src/parser/parse-expression.ts` (array operations)

**Approach:**
1. Add type validation for ANY/ALL/SOME operators
   - Check if argument is array type or subquery
   - Return error 3001 if not
2. Add type validation for array_length()
   - Check first arg is array type
   - Check second arg is integer
   - Return error 3614 if invalid
3. Add type validation for unnest()
   - Check argument is array type
   - Return error 3616 if not

**Error Codes:** 3001, 3614, 3616 (already defined)

**Dependencies:** Requires type inference for expressions

---

## Category 4: DDL Validation (3 tests)

**Priority:** MEDIUM  
**Complexity:** MEDIUM-HIGH  
**Estimated Effort:** 4-5 hours

### Tests:

1. **create-schema-duplicate.error.test.skip.ts**
   - Query: `create schema auth;` (when auth already exists)
   - Error: `DbtyperError<3200, "Schema already exists; use IF NOT EXISTS">`
   - Missing: Schema existence check in CREATE SCHEMA

2. **create-view-bad-column.error.test.skip.ts**
   - Query: `create view bad_v as select nope_col from t;`
   - Error: `DbtyperError<2300, "Unknown column nope_col">`
   - Missing: Column validation in CREATE VIEW

3. **apply-statements-bad-select-list.error.test.skip.ts**
   - Query: `select 1, 2 from ok_sel;` (in ApplyStatements context)
   - Error: `DbtyperError<3401, "Scalar expression in SELECT requires AS alias">`
   - Missing: SELECT validation in ApplyStatements

### Implementation Plan:

**Location:** `src/parser/parse-sql-statement.ts` (DDL parsers)

**Approach:**
1. **CREATE SCHEMA validation:**
   - Check if schema already exists in database shape
   - Return error 3200 if duplicate (unless IF NOT EXISTS)
   
2. **CREATE VIEW validation:**
   - Parse the SELECT statement in view definition
   - Validate all column references exist
   - Return error 2300 for unknown columns
   
3. **ApplyStatements validation:**
   - Apply same SELECT validation rules as regular queries
   - Ensure scalar expressions have aliases
   - Return error 3401 if missing alias

**Error Codes:** 2300, 3200, 3401 (already defined)

**Dependencies:** 
- Requires database shape tracking
- CREATE VIEW depends on SELECT validation

---

## Category 5: SELECT Validation (4 tests)

**Priority:** MEDIUM  
**Complexity:** VARIES (Simple to Complex)  
**Estimated Effort:** 3-5 hours

### Tests:

1. **select-two-unnamed-scalars.error.test.skip.ts** ⭐ SIMPLE
   - Query: `select 1, 2 from users;`
   - Error: `DbtyperError<3401, "Scalar expression in SELECT requires AS alias">`
   - Missing: Multiple unnamed scalar validation
   - **Note:** Similar to select-multiple-unnamed-scalars.error.test.ts created in Phase 1

2. **select-having-unknown-column.error.test.skip.ts** ⭐ SIMPLE
   - Query: `select region from sales group by region having not_a_col = 'x';`
   - Error: `DbtyperError<2300, "Unknown column not_a_col">`
   - Missing: Column validation in HAVING clause

3. **select-group-by-order-limit-bad-projection.error.test.skip.ts** ⭐⭐ MEDIUM
   - Query: `select region, amount from sales group by region order by region limit 1;`
   - Error: `DbtyperError<3500, "Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">`
   - Missing: GROUP BY projection validation

4. **delete-missing-from.error.test.skip.ts** ⭐ SIMPLE
   - Query: `delete users where id = 'u';` (missing FROM keyword)
   - Error: Generic parser error
   - Missing: DELETE syntax validation

### Implementation Plan:

**Location:** Various parsers

**Approach:**

1. **Multiple unnamed scalars (SIMPLE):**
   - Location: `src/parser/parse-select.ts`
   - Check if multiple scalar expressions lack aliases
   - Return error 3401
   - **May already be implemented** - check if test can be unskipped

2. **HAVING unknown column (SIMPLE):**
   - Location: `src/parser/parse-select.ts` (HAVING clause)
   - Validate column references in HAVING against available columns
   - Return error 2300

3. **GROUP BY projection validation (MEDIUM):**
   - Location: `src/parser/parse-select.ts` (GROUP BY handling)
   - Check that non-aggregated columns in SELECT appear in GROUP BY
   - Return error 3500

4. **DELETE missing FROM (SIMPLE):**
   - Location: `src/parser/parse-delete.ts`
   - Add syntax validation for DELETE statement
   - Ensure FROM keyword is present
   - Return generic parser error

**Error Codes:** 2300, 3401, 3500 (already defined)

**Dependencies:**
- GROUP BY validation requires understanding of aggregate functions
- HAVING validation requires column scope tracking

---

## Implementation Priority & Order

### Phase 2.1: Quick Wins (4-5 hours)

**Goal:** Implement simple, high-impact validations

1. **Function Arity Validation** (5 tests)
   - sum(), coalesce(), lower(), now()
   - UUID literal validation
   - Complexity: SIMPLE
   - Impact: HIGH

2. **Array Type Validation** (3 tests)
   - ANY/ALL/SOME, array_length(), unnest()
   - Complexity: MEDIUM
   - Impact: HIGH

**Total:** 8 tests unskipped

### Phase 2.2: Type System Enhancements (3-4 hours)

**Goal:** Implement type cast validation

3. **Type Cast Validation** (2 tests)
   - Boolean ↔ Integer casts
   - Complexity: MEDIUM
   - Impact: HIGH

**Total:** 2 tests unskipped (10 cumulative)

### Phase 2.3: SELECT Enhancements (3-5 hours)

**Goal:** Implement remaining SELECT validations

4. **SELECT Validation** (4 tests)
   - Multiple unnamed scalars
   - HAVING unknown column
   - GROUP BY projection validation
   - DELETE missing FROM
   - Complexity: SIMPLE to MEDIUM
   - Impact: MEDIUM

**Total:** 4 tests unskipped (14 cumulative)

### Phase 2.4: DDL Validation (4-5 hours)

**Goal:** Implement DDL validations (most complex)

5. **DDL Validation** (3 tests)
   - CREATE SCHEMA duplicate check
   - CREATE VIEW column validation
   - ApplyStatements SELECT validation
   - Complexity: MEDIUM-HIGH
   - Impact: MEDIUM

**Total:** 3 tests unskipped (17 cumulative)

---

## Parallel Implementation Opportunities

The following can be implemented in parallel (no dependencies):

**Track A: Function Validation**
- Function arity checks (5 tests)

**Track B: Type Validation**
- Type cast validation (2 tests)
- Array type validation (3 tests)

**Track C: SELECT Validation**
- HAVING column validation (1 test)
- Multiple unnamed scalars (1 test)
- DELETE syntax (1 test)

**Track D: Complex Validation** (do last)
- GROUP BY projection (1 test)
- DDL validations (3 tests)

---

## Risk Assessment

### Low Risk (Can implement immediately)

- Function arity validation (well-defined, isolated)
- Array type validation (clear type checks)
- HAVING column validation (similar to WHERE)
- DELETE syntax validation (parser-level)

### Medium Risk (Requires careful testing)

- Type cast validation (affects type system broadly)
- Multiple unnamed scalars (may already work)
- GROUP BY projection (complex logic)

### High Risk (May require architectural changes)

- CREATE SCHEMA duplicate check (requires state tracking)
- CREATE VIEW validation (requires full SELECT validation in DDL context)
- ApplyStatements validation (requires integration with migration system)

---

## Source Files to Modify

Based on analysis, these source files will need changes:

1. **src/parser/parse-expression.ts**
   - Function arity validation
   - Type cast validation
   - Array operation validation

2. **src/parser/parse-select.ts**
   - Multiple unnamed scalars
   - HAVING column validation
   - GROUP BY projection validation

3. **src/parser/parse-delete.ts**
   - DELETE syntax validation

4. **src/parser/parse-sql-statement.ts**
   - CREATE SCHEMA duplicate check
   - CREATE VIEW validation
   - ApplyStatements validation

5. **src/parser/parse-insert.ts**
   - UUID literal validation

---

## Error Codes Summary

All error codes are already defined in the codebase:

- **2300:** Unknown column
- **2800:** Cannot cast integer to boolean
- **2801:** Cannot cast boolean to integer
- **3001:** ANY/ALL/SOME requires array or subquery
- **3200:** Schema already exists
- **3401:** Scalar expression requires AS alias
- **3500:** Grouped SELECT requires column in GROUP BY or aggregate
- **3600:** Function requires at least one argument
- **3601:** Aggregate function requires an argument
- **3602:** Function requires at least one argument (COALESCE)
- **3614:** array_length expects (array, integer)
- **3616:** unnest expects an array

**No new error codes needed.**

---

## Verification Strategy

For each category:

1. **Implement validation logic**
2. **Rename `.skip.ts` to `.ts`**
3. **Add to `tsconfig.test.json`** (if needed)
4. **Run `npm run typecheck:test`** - verify type errors appear
5. **Run `npm test`** - verify tests pass
6. **Check infrastructure tests** - ensure patterns still valid

---

## Estimated Total Effort

| Phase | Tests | Hours |
|-------|-------|-------|
| 2.1: Quick Wins | 8 | 4-5 |
| 2.2: Type Casts | 2 | 3-4 |
| 2.3: SELECT | 4 | 3-5 |
| 2.4: DDL | 3 | 4-5 |
| **Total** | **17** | **14-19 hours** |

**Note:** Original estimate was 12-16 hours for 76 tests. With only 17 tests, 14-19 hours is reasonable given the complexity of some validations.

---

## Next Steps

1. **Update feature plan** with corrected test count (17, not 76)
2. **Start with Phase 2.1** (Function Arity Validation)
3. **Use parallel implementation** where possible
4. **Test frequently** after each validation is added
5. **Document learnings** in workflow docs

---

## Questions for Clarification

1. **Where are the other 59 tests?** Feature doc mentions 76 skipped tests, but only 17 exist. Were they already unskipped, or was the estimate incorrect?

2. **Should we create additional tests?** If 59 tests are missing, should we create them as part of Phase 2?

3. **Priority adjustment?** With only 17 tests, should we adjust the timeline and combine with Phase 1 verification?

---

## Appendix: Complete Test List

### DDL Tests (3)
1. apply-statements-bad-select-list.error.test.skip.ts
2. create-schema-duplicate.error.test.skip.ts
3. create-view-bad-column.error.test.skip.ts

### DELETE Tests (1)
4. delete-missing-from.error.test.skip.ts

### INSERT Tests (1)
5. insert-uuid-without-cast.error.test.skip.ts

### SELECT Tests (12)
6. select-any-non-array.error.test.skip.ts
7. select-array-length-non-array.error.test.skip.ts
8. select-cast-cannot-cast-boolean-to-integer.error.test.skip.ts
9. select-cast-cannot-cast-integer-to-boolean.error.test.skip.ts
10. select-coalesce-empty.error.test.skip.ts
11. select-group-by-order-limit-bad-projection.error.test.skip.ts
12. select-having-unknown-column.error.test.skip.ts
13. select-lower-empty.error.test.skip.ts
14. select-now-wrong-arity.error.test.skip.ts
15. select-sum-empty.error.test.skip.ts
16. select-two-unnamed-scalars.error.test.skip.ts
17. select-unnest-non-array.error.test.skip.ts

**Total: 17 tests**
