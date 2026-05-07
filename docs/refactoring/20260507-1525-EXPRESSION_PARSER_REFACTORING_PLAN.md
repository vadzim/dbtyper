# Expression Parser Refactoring Plan

**Date:** 2026-05-07  
**Branch:** refactor-expression-parser  
**Worktree:** `.worktree/refactor-expression-parser`

## Problem Statement

From `TODO.md` lines 5-6:

- Line 5: "fix a mess in parse select - parse select inner expression should be just parse select expression and then consume ')', no bunch of _Inner_ types"
- Line 6: "fix a mess in parse select - parsing select as value should be just parse select expression and then check that number of columns is 1"

## Current State Analysis

### 1. Parse Expression Structure (`src/parser/parse-expression.ts`)

**File size:** 2821 lines

**Current architecture:**

- `ParseExpressionAST` - builds untyped `ScalarExprAst`
- `ResolveExpressionAST` - type-checks AST once scope is known
- Supports: arithmetic, boolean ops, comparisons, `IS NULL`, `IN`, `BETWEEN`, `LIKE`, `CASE`, casts, subqueries, array ops, function calls

**Key types:**

- `ScalarExprAst` - 30+ AST node kinds
- `ExprParseEnv` - threading catalog, params, outer scope for subqueries
- `ExprOk<Sql>` / `ExprSqlNull` - resolved expression results

### 2. Parse Select Structure (`src/parser/parse-select.ts`)

**File size:** 2333 lines

**The "mess" - duplicate parsing logic for subqueries:**

#### Current Duplication:

There are **TWO separate code paths** for parsing `SELECT` inside parentheses:

**Path A: Parenthesized subqueries (for expressions)**

- `ParseParenEnclosedSelect` - multi-column allowed (for `EXISTS`, `IN (SELECT)`, CTEs)
- `ParseParenScalarSelect` - exactly one column (for scalar subqueries)
- Both call → `ParseInnerParenSelectAfterSelectKw`
    - → `ParseInnerParenSelectBody`
    - → `ParseInnerParenSelectFromAndResolve`
    - → `ParseInnerParenSelectWhereClose`
    - → `ReadClosingParenScalarSubqueryOnly` (consumes `)`)

**Path B: Derived tables (for FROM clause)**

- `ParseParenDerivedSelect` - used in `FROM (SELECT ...) alias`
- Calls → `ParseInnerDerivedAfterSelectKw`
    - → `ParseInnerDerivedBody`
    - → `ParseInnerDerivedWhereCloseAndAlias`
    - → `ReadClosingParenAndAliasDerived` (consumes `)` and alias)

#### Key Differences:

| Aspect               | Path A (Subquery)                                     | Path B (Derived)                  |
| -------------------- | ----------------------------------------------------- | --------------------------------- |
| **Entry point**      | `ParseParenEnclosedSelect` / `ParseParenScalarSelect` | `ParseParenDerivedSelect`         |
| **After parsing**    | `ReadClosingParenScalarSubqueryOnly`                  | `ReadClosingParenAndAliasDerived` |
| **Returns**          | `[Tokens, Result]` (2-tuple)                          | `[Tokens, Mid, Scope]` (3-tuple)  |
| \*\*Consumes `)`     | Yes                                                   | Yes                               |
| **Requires alias**   | No                                                    | Yes                               |
| **Outer scope**      | Passed through for correlation                        | Used for alias merging            |
| **Projection check** | Scalar: exactly 1 column                              | Any: no restriction               |

#### The Problem:

1. **Code duplication:** ~200 lines of nearly identical SELECT parsing logic
2. **Maintenance burden:** Bug fixes need to be applied twice
3. **Inconsistency risk:** The two paths can diverge over time
4. **Complexity:** 8 `ParseInner*` types that are hard to understand

### 3. Root Cause

The duplication exists because:

1. **Different return types:** Subqueries return 2-tuple, derived tables return 3-tuple with scope
2. **Different post-processing:** Subqueries just consume `)`, derived tables need alias parsing
3. **Historical growth:** Features were added incrementally without refactoring

## Refactoring Goals

1. **Eliminate `ParseInner*` types** - replace with reusable `ParseSelectExpression`
2. **Single SELECT parsing path** - parse once, then post-process based on context
3. **Cleaner separation of concerns:**
    - Parse SELECT → get result
    - Consume `)` → separate helper
    - Check column count → separate validator
    - Parse alias → separate helper

## Proposed Solution

### Phase 1: Unify SELECT Parsing

**Current:**

```typescript
ParseParenEnclosedSelect → ParseInnerParenSelectAfterSelectKw → ... → ReadClosingParenScalarSubqueryOnly
ParseParenDerivedSelect → ParseInnerDerivedAfterSelectKw → ... → ReadClosingParenAndAliasDerived
```

**Proposed:**

```typescript
ParseParenEnclosedSelect → ParseSelectExpression → ConsumeClosingParen
ParseParenDerivedSelect → ParseSelectExpression → ConsumeClosingParen → ParseAlias
ParseParenScalarSelect → ParseSelectExpression → ValidateSingleColumn → ConsumeClosingParen
```

### Phase 2: New Helper Types

#### 2.1 `ConsumeClosingParen`

```typescript
type ConsumeClosingParen<Tokens extends TokensList, Result> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Result]
		: SkipFailedExpression<Tokens, SqlParserError<"Expected `)` after subquery">>
```

#### 2.2 `ValidateSingleColumn`

```typescript
type ValidateSingleColumn<Result extends JsqlSelectStatementResult> =
	Result["columns"] extends Record<string, any>
		? [keyof Result["columns"]] extends [infer K]
			? K extends string
				? Result // exactly one column
				: SqlParserError<"Scalar subquery must project exactly one column">
			: SqlParserError<"Scalar subquery must project exactly one column">
		: SqlParserError<"Invalid subquery result">
```

#### 2.3 `ParseAliasAfterDerived`

```typescript
type ParseAliasAfterDerived<
  Tokens extends TokensList,
  Db extends JsqlDatabaseShape,
  OuterScope extends ScopeMap,
  Result extends JsqlSelectStatementResult
> =
  // Parse optional AS + required alias name
  // Return [Tokens, null, MergedScope]
```

### Phase 3: Refactor Call Sites

#### 3.1 `ParseParenScalarSelect` (for scalar subqueries in expressions)

```typescript
export type ParseParenScalarSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params> extends [
				infer R2 extends TokensList,
				infer Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ValidateSingleColumn<Result> extends infer Validated
						? Validated extends SqlParserError<string>
							? SkipFailedExpression<R2, Validated>
							: ConsumeClosingParen<R2, Validated>
						: never
					: never
			: never
		: SkipFailedExpression<R1, SqlParserError<"Expected SELECT in subquery">>
```

#### 3.2 `ParseParenEnclosedSelect` (for multi-column subqueries)

```typescript
export type ParseParenEnclosedSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params> extends [
				infer R2 extends TokensList,
				infer Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result>
					: never
			: never
		: SkipFailedExpression<R1, SqlParserError<"Expected SELECT in subquery">>
```

#### 3.3 `ParseParenDerivedSelect` (for FROM clause derived tables)

```typescript
type ParseParenDerivedSelect<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params> extends [
				infer R2 extends TokensList,
				infer Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends SqlParserError<string>
				? [R2, Result, ParserRefErrorThirdSentinel]
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result> extends [infer R3 extends TokensList, infer Validated]
						? Validated extends SqlParserError<string>
							? [R3, Validated, ParserRefErrorThirdSentinel]
							: ParseAliasAfterDerived<R3, Db, OuterScope, Validated>
						: never
					: never
			: never
		: [R1, SqlParserError<"Expected SELECT in derived table">, ParserRefErrorThirdSentinel]
```

## Implementation Steps

### Step 1: Add Helper Types (Non-breaking)

- [ ] Add `ConsumeClosingParen` type
- [ ] Add `ValidateSingleColumn` type
- [ ] Add `ParseAliasAfterDerived` type
- [ ] Add tests for each helper

### Step 2: Refactor `ParseParenScalarSelect` (Breaking)

- [ ] Rewrite to use `ParseSelectExpression` + helpers
- [ ] Run tests to ensure no regressions
- [ ] Fix any broken tests

### Step 3: Refactor `ParseParenEnclosedSelect` (Breaking)

- [ ] Rewrite to use `ParseSelectExpression` + helpers
- [ ] Run tests to ensure no regressions
- [ ] Fix any broken tests

### Step 4: Refactor `ParseParenDerivedSelect` (Breaking)

- [ ] Rewrite to use `ParseSelectExpression` + helpers
- [ ] Run tests to ensure no regressions
- [ ] Fix any broken tests

### Step 5: Remove Dead Code

- [ ] Delete `ParseInnerParenSelectAfterSelectKw`
- [ ] Delete `ParseInnerParenSelectBody`
- [ ] Delete `ParseInnerParenSelectFromAndResolve`
- [ ] Delete `ParseInnerParenSelectWhereClose`
- [ ] Delete `ParseInnerDerivedAfterSelectKw`
- [ ] Delete `ParseInnerDerivedBody`
- [ ] Delete `ParseInnerDerivedWhereCloseAndAlias`
- [ ] Delete `ReadClosingParenScalarSubqueryOnly`
- [ ] Delete `ReadClosingParenAndAliasDerived`

### Step 6: Verify and Document

- [ ] Run full test suite
- [ ] Update `SUPPORTED-SQL.md` if needed
- [ ] Update `TODO.md` to mark items as done
- [ ] Add entry to `LOG.md`

## Expected Benefits

1. **Code reduction:** ~200 lines removed
2. **Maintainability:** Single SELECT parsing path
3. **Clarity:** Clear separation of concerns
4. **Consistency:** No risk of divergence between paths
5. **Extensibility:** Easier to add new SELECT features

## Risks and Mitigation

### Risk 1: Breaking existing functionality

**Mitigation:** Run full test suite after each step, fix regressions immediately

### Risk 2: Performance impact (deeper type nesting)

**Mitigation:** Monitor TypeScript compilation time, optimize if needed

### Risk 3: Outer scope correlation issues

**Mitigation:** Ensure `ParseSelectExpression` properly threads `OuterScope` parameter

## Testing Strategy

1. **Unit tests:** Test each helper type independently
2. **Integration tests:** Test all three call sites (scalar, enclosed, derived)
3. **Regression tests:** Ensure all existing tests still pass
4. **Edge cases:**
    - Scalar subquery with 0 columns → error
    - Scalar subquery with 2+ columns → error
    - Derived table without alias → error
    - Nested subqueries
    - Subqueries with WHERE/GROUP BY/ORDER BY

## Success Criteria

- [ ] All `ParseInner*` types removed
- [ ] All tests passing
- [ ] No increase in TypeScript compilation time
- [ ] Code is more readable and maintainable
- [ ] TODO.md items 5-6 marked as complete

## Timeline Estimate

- **Step 1:** 2-3 hours (helpers + tests)
- **Step 2:** 2-3 hours (scalar subquery refactor)
- **Step 3:** 1-2 hours (enclosed subquery refactor)
- **Step 4:** 2-3 hours (derived table refactor)
- **Step 5:** 1 hour (cleanup)
- **Step 6:** 1-2 hours (verification)

**Total:** 9-14 hours

## Notes

- This refactoring does NOT change the parser's capabilities
- This is purely a code quality improvement
- The refactoring should be done incrementally with tests after each step
- If any step causes major issues, we can revert that step and try a different approach
