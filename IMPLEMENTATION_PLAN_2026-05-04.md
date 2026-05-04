# Implementation Plan: Advanced SQL Features

**Date:** 2026-05-04 16:52 (UTC+2)
**Status:** In Progress

## Overview

This document outlines the implementation plan for the remaining advanced SQL features in the jsql type-level SQL parser. These features are required to enable the final 11 integration tests.

## Completed Work (Session Summary)

- ✅ Enabled 22 integration tests autonomously
- ✅ Implemented CROSS JOIN support with full type safety
- ✅ Added unit tests for CROSS JOIN
- ✅ Total enabled tests: 98 out of 109

## Remaining Features (11 tests)

### 1. Subqueries (4 tests) - **PRIORITY: HIGH**

Subqueries are foundational for other features and should be implemented first.

#### 1.1 Scalar Subqueries (`select-scalar-subquery.test.skip.ts`)

**Description:** Subqueries that return a single value, used in SELECT list or WHERE clause.
**Example:** `SELECT id, (SELECT COUNT(*) FROM posts WHERE posts.user_id = users.id) FROM users`

**Implementation Strategy:**

1. **Parser Changes:**
    - Modify `ParseExpressionAST` in `parse-expression.ts` to recognize `(SELECT ...)` as an expression atom
    - Add new expression kind: `ExprSubquery` with nested `JsqlSelectStatementResult`
    - Handle parenthesized SELECT statements in expression context

2. **Type Resolution:**
    - Extract single column type from subquery result
    - Validate that subquery returns exactly one column
    - Error if subquery returns multiple columns: `SqlParserError<"Scalar subquery must return exactly one column">`

3. **Scope Management:**
    - Pass outer scope to inner subquery for correlated references
    - Merge outer scope with subquery's FROM scope
    - Allow subquery to reference outer query columns

4. **Validation:**
    - Ensure subquery is valid SELECT statement
    - Type-check correlated column references
    - Validate subquery result cardinality (single column)

**Files to Modify:**

- `src/parser/parse-expression.ts` - Add subquery expression support
- `src/parser/parse-select.ts` - Export helper types for subquery parsing
- `test/parse-expression.test.ts` - Add unit tests

**Estimated Complexity:** High (requires recursive SELECT parsing in expression context)

#### 1.2 Subqueries in WHERE (`select-subquery-in-where.test.skip.ts`)

**Description:** Subqueries used with IN, EXISTS, or comparison operators in WHERE clause.
**Example:** `SELECT * FROM users WHERE id IN (SELECT user_id FROM posts)`

**Implementation Strategy:**

1. Extend WHERE expression parser to handle:
    - `column IN (SELECT ...)` - subquery returns set of values
    - `column = (SELECT ...)` - scalar subquery comparison
    - `EXISTS (SELECT ...)` - boolean subquery

2. Add validation:
    - IN subquery must return single column
    - Scalar comparison subquery must return single column
    - Type compatibility between column and subquery result

**Dependencies:** Requires 1.1 (Scalar Subqueries)

#### 1.3 EXISTS Subqueries (`select-subquery-exists.test.skip.ts`)

**Description:** Boolean subqueries that test for row existence.
**Example:** `SELECT * FROM users WHERE EXISTS (SELECT 1 FROM posts WHERE posts.user_id = users.id)`

**Implementation Strategy:**

1. Add `EXISTS` keyword support in WHERE expression parser
2. EXISTS always returns boolean type regardless of subquery columns
3. Validate subquery is valid SELECT (columns don't matter for EXISTS)

**Dependencies:** Requires 1.1 (Scalar Subqueries)

#### 1.4 Correlated Subqueries (`select-correlated-subquery.test.skip.ts`)

**Description:** Subqueries that reference columns from outer query.
**Example:** `SELECT id, (SELECT title FROM posts WHERE posts.user_id = users.id LIMIT 1) FROM users`

**Implementation Strategy:**

1. Pass outer scope through to subquery parser
2. Resolve column references in subquery against both:
    - Subquery's own FROM scope
    - Outer query scope (for correlated references)
3. Validate correlated column references exist in outer scope

**Dependencies:** Requires 1.1 (Scalar Subqueries)
**Note:** This is partially implemented by 1.1's scope management

---

### 2. Common Table Expressions (CTEs) (4 tests) - **PRIORITY: MEDIUM**

CTEs provide named temporary result sets. Implementation is partially started in `parse-select.ts`.

#### 2.1 Simple CTE (`select-simple-cte.test.skip.ts`)

**Description:** Basic WITH clause defining a single CTE.
**Example:** `WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM active_users`

**Implementation Strategy:**

1. **Current State:** Parser has `ParseSelectWithCtes` stub that expects SELECT after WITH
2. **Required Changes:**
    - Complete CTE name parsing after WITH keyword
    - Parse CTE column list (optional): `WITH cte (col1, col2) AS (...)`
    - Parse AS keyword and subquery
    - Store CTE in scope as derived table
    - Continue parsing main SELECT with CTE in scope

3. **Type Resolution:**
    - Infer CTE columns from subquery result
    - If explicit column list provided, validate count matches subquery
    - Make CTE available in main query scope

**Files to Modify:**

- `src/parser/parse-select.ts` - Complete `ParseSelectWithCtes` implementation
- `test/parse-select.test.ts` - Add CTE unit tests

**Dependencies:** Requires subquery support (1.1)

#### 2.2 Multiple CTEs (`select-multiple-ctes.test.skip.ts`)

**Description:** Multiple CTEs in single WITH clause.
**Example:** `WITH cte1 AS (...), cte2 AS (...) SELECT * FROM cte1 JOIN cte2`

**Implementation Strategy:**

1. Parse comma-separated CTE definitions
2. Each CTE can reference previously defined CTEs
3. Accumulate CTEs in scope map
4. All CTEs available to main query

**Dependencies:** Requires 2.1 (Simple CTE)

#### 2.3 CTE in JOIN (`select-ctein-join.test.skip.ts`)

**Description:** Using CTE as table in JOIN clause.
**Example:** `WITH cte AS (...) SELECT * FROM users JOIN cte ON users.id = cte.user_id`

**Implementation Strategy:**

1. Ensure CTE scope is passed through JOIN parsing
2. Resolve CTE name in FROM/JOIN table references
3. Validate CTE columns in ON clause

**Dependencies:** Requires 2.1 (Simple CTE)

#### 2.4 CTE Unknown Column (`select-cteunknown-column.test.skip.ts`)

**Description:** Error handling for invalid CTE column references.
**Example:** `WITH cte AS (SELECT id FROM users) SELECT wrong_col FROM cte` (should error)

**Implementation Strategy:**

1. Validate column references against CTE's inferred columns
2. Return appropriate error: `SqlParserError<"Unknown column in CTE">`

**Dependencies:** Requires 2.1 (Simple CTE)

---

### 3. Advanced DML Features (3 tests) - **PRIORITY: LOW**

These are PostgreSQL-specific extensions to standard SQL.

#### 3.1 INSERT...SELECT (`insert-with-select.test.skip.ts`)

**Description:** Insert rows from SELECT query result.
**Example:** `INSERT INTO backup (id, name) SELECT id, name FROM users`

**Implementation Strategy:**

1. **Parser Changes:**
    - After column list in INSERT, check for SELECT keyword instead of VALUES
    - Parse full SELECT statement
    - Validate SELECT result columns match INSERT column list

2. **Type Validation:**
    - Match SELECT column types to INSERT column types
    - Validate column count matches
    - Check NOT NULL constraints

**Files to Modify:**

- `src/parser/parse-insert.ts` - Add SELECT branch after column list
- `test/parse-insert.test.ts` - Add unit tests

**Dependencies:** Requires subquery support (1.1)

#### 3.2 UPDATE...FROM (`update-with-from.test.skip.ts`)

**Description:** Update with additional tables in FROM clause.
**Example:** `UPDATE users SET name = 'Author' FROM posts WHERE users.id = posts.user_id`

**Implementation Strategy:**

1. **Parser Changes:**
    - After SET clause, check for FROM keyword
    - Parse FROM clause with JOIN support (reuse SELECT FROM parser)
    - Merge FROM scope with UPDATE table scope
    - Parse WHERE with combined scope

2. **Scope Management:**
    - UPDATE table is primary scope
    - FROM tables are additional scope
    - WHERE can reference all tables

**Files to Modify:**

- `src/parser/parse-update.ts` - Add FROM clause parsing
- `test/parse-update.test.ts` - Add unit tests

**Dependencies:** None (uses existing FROM/JOIN parser)

#### 3.3 DELETE...USING (`delete-with-using.test.skip.ts`)

**Description:** Delete with additional tables in USING clause.
**Example:** `DELETE FROM users USING posts WHERE users.id = posts.user_id`

**Implementation Strategy:**

1. **Parser Changes:**
    - After DELETE FROM table, check for USING keyword
    - Parse USING clause (similar to FROM clause)
    - Merge USING scope with DELETE table scope
    - Parse WHERE with combined scope

2. **Scope Management:**
    - DELETE table is primary scope
    - USING tables are additional scope
    - WHERE can reference all tables

**Files to Modify:**

- `src/parser/parse-delete.ts` - Add USING clause parsing
- `test/parse-delete.test.ts` - Add unit tests

**Dependencies:** None (uses existing FROM/JOIN parser)

---

## Implementation Order (Recommended)

### Phase 1: Subqueries (Foundation)

1. **Scalar Subqueries** (1.1) - Core subquery infrastructure
2. **Subqueries in WHERE** (1.2) - Extend to WHERE clause
3. **EXISTS Subqueries** (1.3) - Boolean subqueries
4. **Correlated Subqueries** (1.4) - Already mostly covered by 1.1

**Rationale:** Subqueries are foundational for CTEs and INSERT...SELECT. Implementing them first enables other features.

### Phase 2: CTEs (Building on Subqueries)

1. **Simple CTE** (2.1) - Basic WITH clause
2. **Multiple CTEs** (2.2) - Comma-separated CTEs
3. **CTE in JOIN** (2.3) - Use CTE in JOIN
4. **CTE Error Handling** (2.4) - Validation

**Rationale:** CTEs build directly on subquery infrastructure. Natural progression after subqueries.

### Phase 3: Advanced DML (Independent Features)

1. **UPDATE...FROM** (3.2) - Simpler, reuses FROM parser
2. **DELETE...USING** (3.3) - Similar to UPDATE...FROM
3. **INSERT...SELECT** (3.1) - Requires subquery support

**Rationale:** These are independent features that can be implemented in any order. UPDATE...FROM and DELETE...USING are simpler as they reuse existing parsers.

---

## Technical Challenges

### Challenge 1: Recursive Type Instantiation

**Problem:** Subqueries create recursive type structures (SELECT within SELECT).
**Solution:**

- Use type-level recursion carefully to avoid infinite loops
- Limit nesting depth if necessary
- Use `infer` to break recursion chains

### Challenge 2: Scope Management

**Problem:** Nested queries need access to outer scope for correlated references.
**Solution:**

- Pass outer scope as parameter to subquery parser
- Merge outer and inner scopes for column resolution
- Maintain scope hierarchy for proper resolution order

### Challenge 3: Type Inference Across Boundaries

**Problem:** Subquery result types must be inferred and used in outer query.
**Solution:**

- Extract column types from `JsqlSelectStatementResult`
- Create derived table entries for subqueries
- Validate type compatibility at boundaries

### Challenge 4: Error Messages

**Problem:** Nested errors can be confusing.
**Solution:**

- Provide clear error messages with context
- Indicate whether error is in outer or inner query
- Use descriptive error types

---

## Testing Strategy

### Unit Tests

For each feature, add type-level unit tests in corresponding test file:

- Positive cases (valid syntax)
- Negative cases (errors)
- Edge cases (empty results, NULL handling)
- Type inference validation

### Integration Tests

Enable corresponding `.test.skip.ts` files as features are completed:

- Test with real database schema
- Verify end-to-end type safety
- Test error cases with `@ts-expect-error`

### Regression Tests

- Run full test suite after each feature
- Ensure existing tests still pass
- Check for type performance issues

---

## Current Decision: Start with Scalar Subqueries

**Starting with:** Scalar Subqueries (1.1)

**Reasoning:**

1. Most foundational feature
2. Required for all other subquery types
3. Establishes patterns for recursive parsing
4. Enables 4 integration tests once complete

**Next Steps:**

1. Analyze current expression parser structure
2. Add subquery expression type
3. Implement recursive SELECT parsing in expression context
4. Add scope passing for correlated references
5. Validate single-column result
6. Add unit tests
7. Enable integration test

**Estimated Time:** 2-3 hours for full implementation with tests

---

## Notes

- All features maintain type-level parsing (no runtime code)
- Focus on PostgreSQL syntax (primary target)
- Maintain existing code style and patterns
- Follow workspace rules (exports-first, monad-checker, etc.)
- Add comprehensive unit test coverage for each feature
- Document complex type logic with comments

---

## Progress Tracking

- [x] CROSS JOIN
- [ ] Scalar Subqueries (IN PROGRESS)
- [ ] Subqueries in WHERE
- [ ] EXISTS Subqueries
- [ ] Correlated Subqueries
- [ ] Simple CTE
- [ ] Multiple CTEs
- [ ] CTE in JOIN
- [ ] CTE Error Handling
- [ ] INSERT...SELECT
- [ ] UPDATE...FROM
- [ ] DELETE...USING

**Target:** Enable all 109 integration tests
**Current:** 98/109 (90%)
**Remaining:** 11 tests (10%)
