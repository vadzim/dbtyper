# Implement Correlated Subqueries Status

**Date:** 2026-05-09 16:50  
**Current State:** Not Started

**If this feature is marked as COMPLETE:**

- An agent resuming this feature should tell you it's complete
- Agent should ask: "This feature is complete. What would you like me to do?"
- Agent should NOT start working without your instruction
- You might want to: review it, test it, add something, or start a new feature

**This is a feature plan document. Save it in `.features/` folder as `YYYY-MM-DD-HHMM-feature-name.md`**

**CRITICAL: Before working on this feature, you MUST read .workflow/ folder:**

1. **FIRST:** Read `.workflow/README.md` - Workflow instructions and guidelines
2. **SECOND:** Read `.workflow/findings.md` - General development patterns and techniques
3. **THIRD:** Read `.workflow/project_knowledge.md` - Project-specific conventions and knowledge
4. **FOURTH:** Read `.workflow/feature_template.md` - Template structure

**This applies whether you are starting, resuming, or reviewing this feature.**

**Part of the 5-document system:**

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/YYYY-MM-DD-HHMM-name.md - Current feature plan (THIS FILE)

---

## Overview

Implement correlated subqueries where outer FROM scope is visible in subquery WHERE clauses and expression sites. This is Track D in ROADMAP.md and a TODO item under "Subqueries, CTEs, views".

**Current state:**
- Basic subqueries work: scalar `(SELECT expr)`, `IN (SELECT ...)`, `EXISTS (SELECT ...)`
- CTEs (`WITH ... AS`) are implemented
- Subqueries currently have no outer correlation - they cannot reference outer FROM scope

**What needs to be done:**
- Thread outer scope through subquery parsing so inner queries can reference outer columns
- Enable correlation in WHERE clauses and expression sites
- Maintain proper scope isolation (inner FROM shadows outer)

**Explicitly excluded from v1:**
- `LATERAL` joins (deferred per ROADMAP.md Track D note)
- `CROSS JOIN LATERAL` / `LEFT JOIN LATERAL`
- Correlated derived tables in FROM clause

**Success criteria:**
- Outer columns accessible in subquery WHERE clauses
- Proper type checking for correlated references
- Scope shadowing works correctly (inner FROM hides outer columns with same name)
- All tests pass with 0 TypeScript errors

---

## Migration Status

### ✅ Completed (Working)

None yet - feature not started.

### ❌ Incomplete (Causing Failures)

1. **Subquery Scope Threading** (`src/parser/parse-select.ts`, `src/parser/parse-expression.ts`)
    - **Problem:** Subqueries currently parse with empty outer scope
    - **Impact:** Cannot reference outer FROM columns in subquery WHERE/expressions
    - **Proper fix needed:** Thread outer scope through ParseScalarExprUntyped and subquery parsing

2. **Scope Resolution** (`src/resolver/resolve-expression.ts`)
    - **Problem:** Expression resolver doesn't have access to outer scope context
    - **Impact:** Cannot resolve outer column references in correlated subqueries
    - **Proper fix needed:** Pass outer scope through resolution chain

---

## Current Test Failures

**Total errors:** 0 (feature not yet started)

**Expected test patterns after implementation:**

1. **Correlated WHERE clause:**
    ```sql
    SELECT u.id FROM users u WHERE EXISTS (
      SELECT 1 FROM orders o WHERE o.user_id = u.id
    )
    ```

2. **Correlated scalar subquery:**
    ```sql
    SELECT u.id, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) 
    FROM users u
    ```

3. **Scope shadowing:**
    ```sql
    SELECT u.id FROM users u WHERE EXISTS (
      SELECT 1 FROM users WHERE users.id = u.id
    )
    -- Inner 'users' shadows outer 'u', so 'u.id' must still resolve to outer
    ```

---

## What Needs to Be Done

### Priority 1: Research and Planning

**Goal:** Understand current subquery implementation and plan scope threading approach

**Files to investigate:**

- `src/parser/parse-select.ts` - How subqueries are currently parsed
- `src/parser/parse-expression.ts` - ParseScalarExprUntyped and subquery entry points
- `src/resolver/resolve-expression.ts` - Expression resolution and scope handling
- `test/integration/select/` - Existing subquery tests to understand patterns

**Approach:**

1. Launch planning subagent to research codebase
2. Identify where scope is currently passed (or not passed)
3. Map out the threading path: ParseSelect → ParseExpression → subquery parsing
4. Identify type signatures that need updating
5. Plan test cases covering correlation scenarios

**Estimated effort:** 30-45 minutes (via subagent)

### Priority 2: Implement Scope Threading

**Goal:** Thread outer scope through subquery parsing infrastructure

**Files to update:**

- `src/parser/parse-select.ts`
    - Update ParseSelect to accept outer scope parameter
    - Pass outer scope to WHERE clause parsing
    - Pass outer scope to SELECT list expression parsing
    
- `src/parser/parse-expression.ts`
    - Update ParseScalarExprUntyped to accept outer scope
    - Thread outer scope into subquery parsing calls
    - Merge outer scope with inner FROM scope appropriately

- `src/resolver/resolve-expression.ts`
    - Update ResolveExpressionAST to handle outer scope
    - Implement scope shadowing logic (inner FROM hides outer)
    - Resolve qualified column references checking both scopes

**Approach:**

1. Start with type signatures - add OuterScope parameter
2. Thread through parser call chain
3. Implement scope merging logic (inner shadows outer)
4. Update resolver to check both scopes

**Estimated effort:** 2-3 hours

### Priority 3: Add Comprehensive Tests

**Goal:** Verify correlated subqueries work correctly with proper type inference

**Files to create/update:**

- `test/integration/select/select-correlated-subquery-exists.success.test.ts`
    - Basic EXISTS with outer column reference
    
- `test/integration/select/select-correlated-subquery-scalar.success.test.ts`
    - Scalar subquery referencing outer columns
    
- `test/integration/select/select-correlated-subquery-in.success.test.ts`
    - IN subquery with correlation
    
- `test/integration/select/select-correlated-subquery-scope-shadowing.success.test.ts`
    - Verify inner FROM shadows outer correctly
    
- `test/integration/select/select-correlated-subquery-unknown-outer-column.error.test.ts`
    - Error when referencing non-existent outer column
    
- `test/integration/select/select-correlated-subquery-type-mismatch.error.test.ts`
    - Error when correlation comparison has type mismatch

**Estimated effort:** 1-2 hours

### Priority 4: Documentation and Edge Cases

**Goal:** Document the feature and handle edge cases

**Files to update:**

- `docs/SUPPORTED-SQL.md`
    - Add correlated subquery section
    - Document scope rules
    - Note LATERAL exclusion
    
- `TODO.md`
    - Mark correlated subquery item as complete
    - Keep LATERAL as deferred item

**Edge cases to verify:**

- Multiple nesting levels (subquery in subquery)
- Correlation in SELECT list vs WHERE clause
- Qualified vs unqualified column references
- Ambiguous column names (should error)

**Estimated effort:** 1 hour

---

## Migration Strategy

### Recommended Approach: Incremental Scope Threading

1. **Phase 1: Research and Design**
    - Launch planning subagent to map current implementation
    - Identify all call sites that need updating
    - Design scope threading approach
    - Create detailed implementation plan

2. **Phase 2: Type Signatures**
    - Add OuterScope parameter to parser types
    - Update all type signatures in call chain
    - Verify TypeScript compilation (may have errors, that's OK)

3. **Phase 3: Implementation**
    - Implement scope threading in parser
    - Implement scope merging logic
    - Implement resolver updates
    - Fix TypeScript errors incrementally

4. **Phase 4: Testing**
    - Add success test cases
    - Add error test cases
    - Verify all existing tests still pass
    - Run full test suite

5. **Phase 5: Documentation**
    - Update SUPPORTED-SQL.md
    - Update TODO.md
    - Add examples and notes

### Alternative Approach: Big Bang Implementation

1. **Implement all changes at once**
    - Higher risk of breaking existing functionality
    - Harder to debug if issues arise
    - Faster if successful but more likely to need rollback

**Recommendation:** Use incremental approach. Scope threading touches many files and the incremental approach makes it easier to verify each step works before moving to the next.

---

## Technical Challenges

### Challenge 1: Scope Shadowing

**Problem:** Inner FROM scope must shadow outer scope for columns with same name, but outer scope must still be accessible for qualified references.

**Solution:**

- Maintain separate outer and inner scope maps
- Resolution order: inner scope first, then outer scope
- Qualified references (table.column) must check table exists in appropriate scope
- Unqualified references check inner first, then outer

### Challenge 2: Type Parameter Threading

**Problem:** Adding OuterScope parameter affects many type signatures and could cause type instantiation depth issues.

**Current state:** Parser types are already complex with Tokens, Db, Params

**Future state:** Need to add OuterScope without exceeding TypeScript limits

**Solution:**

- Use same patterns as existing Params threading
- Consider combining scope parameters if needed
- Test with complex queries to verify no depth issues

### Challenge 3: Maintaining Backward Compatibility

**Problem:** Existing subquery tests expect no outer correlation

**Solution:**

- Outer scope should be optional/empty by default
- Non-correlated subqueries continue to work as before
- Only correlated references use outer scope
- Verify all existing tests still pass

---

## Testing Strategy

1. **Unit tests:** Type-level tests for scope merging and resolution logic
2. **Integration tests:** End-to-end SQL queries with correlated subqueries
3. **Regression tests:** Verify all existing subquery tests still pass
4. **Type tests:** Verify proper type inference for correlated columns

**Test categories:**

- Correlated EXISTS
- Correlated scalar subqueries
- Correlated IN subqueries
- Scope shadowing
- Multiple nesting levels
- Error cases (unknown columns, type mismatches)

---

## Success Criteria

- [ ] Outer columns accessible in subquery WHERE clauses
- [ ] Outer columns accessible in subquery SELECT expressions
- [ ] Scope shadowing works correctly (inner FROM hides outer)
- [ ] Qualified references resolve correctly
- [ ] Type inference works for correlated columns
- [ ] All existing tests still pass
- [ ] New integration tests cover correlation scenarios
- [ ] 0 TypeScript compilation errors
- [ ] Documentation updated in SUPPORTED-SQL.md
- [ ] TODO.md updated

---

## Timeline Estimate

- **Priority 1:** 30-45 minutes (research and planning via subagent)
- **Priority 2:** 2-3 hours (scope threading implementation)
- **Priority 3:** 1-2 hours (comprehensive tests)
- **Priority 4:** 1 hour (documentation and edge cases)

**Total:** 4.5-6.5 hours of focused work

---

## Notes

- LATERAL is explicitly excluded from v1 per ROADMAP.md
- This is Track D in the active plan
- Correlated subqueries are a prerequisite for many real-world SQL patterns
- Scope threading is the core technical challenge
- Must maintain backward compatibility with existing non-correlated subqueries

---

## Current Workarounds (Temporary)

None - feature not yet implemented.

---

## Related Files

- `src/parser/parse-select.ts` - Main SELECT parser
- `src/parser/parse-expression.ts` - Expression and subquery parsing
- `src/resolver/resolve-expression.ts` - Expression resolution and scope handling
- `test/integration/select/select-subquery-*.test.ts` - Existing subquery tests
- `docs/ROADMAP.md` - Track D: Subqueries
- `TODO.md` - Subqueries section

---

## Detailed TODO Checklist

### Working Rules

**IMPORTANT:** When working on this migration, follow these rules:

1. **Update checkboxes immediately** - Mark `[x]` as soon as a task is completed
    - **CRITICAL: Mark checkboxes [x] IMMEDIATELY after completing each task**
    - **Don't batch updates - update as you go**
    - This makes the plan resumable at any point
2. **Update the plan as you learn** - If you discover new requirements or issues, add them to the plan
3. **Document blockers** - If stuck, add a note explaining what's blocking progress
4. **Keep progress tracking current** - Update the "Last Updated" timestamp and current phase
5. **Make plan resumable** - Any time you stop work, the plan should be clear enough to resume from where you left off
6. **Commit frequently** - Commit the updated plan document after completing each major step
7. **Run `npm test` frequently** - Run tests after completing each significant change or step to catch issues early
8. **Update knowledge documents** - When you discover something that applies beyond this feature:
    - Project-specific → Update `.workflow/project_knowledge.md`
    - General patterns → Update `.workflow/findings.md`

This ensures the plan is always up-to-date and can be resumed at any time.

---

### Phase 1: Research and Planning (Priority 1)

**Goal:** Understand current implementation and create detailed implementation plan

#### Step 1.1: Launch Planning Subagent

- [ ] Launch subagent to research current subquery implementation
- [ ] Subagent reads parse-select.ts, parse-expression.ts, resolve-expression.ts
- [ ] Subagent identifies scope threading points
- [ ] Subagent maps out type signatures that need updating
- [ ] Subagent reviews existing subquery tests

**Notes:** Use subagent to preserve main context for orchestration

#### Step 1.2: Review and Refine Plan

- [ ] Review subagent's findings
- [ ] Identify any gaps or concerns
- [ ] Refine implementation approach based on findings
- [ ] Update this plan with detailed technical approach

#### Step 1.3: Create Test Plan

- [ ] List all test scenarios needed
- [ ] Identify success cases
- [ ] Identify error cases
- [ ] Plan test file structure

### Phase 2: Type Signatures (Priority 2)

**Goal:** Update type signatures to support outer scope parameter

#### Step 2.1: Update Parser Types

- [ ] Add OuterScope type parameter to ParseSelect
- [ ] Add OuterScope parameter to ParseScalarExprUntyped
- [ ] Add OuterScope to subquery parsing entry points
- [ ] Run typecheck to see compilation errors (expected)

#### Step 2.2: Thread Through Call Chain

- [ ] Update ParseWhereExpression to accept outer scope
- [ ] Update ParseSelectList to accept outer scope
- [ ] Update all subquery parsing calls to pass outer scope
- [ ] Run typecheck again

#### Step 2.3: Update Resolver Types

- [ ] Add OuterScope to ResolveExpressionAST
- [ ] Update scope resolution logic signatures
- [ ] Thread through resolver call chain
- [ ] Test: Run typecheck, fix any signature mismatches

### Phase 3: Implementation (Priority 2)

**Goal:** Implement scope threading and resolution logic

#### Step 3.1: Implement Scope Merging

- [ ] Create scope merging logic (inner shadows outer)
- [ ] Handle qualified vs unqualified references
- [ ] Implement scope lookup order
- [ ] Add helper types for scope operations

#### Step 3.2: Update Parser Implementation

- [ ] Implement outer scope passing in ParseSelect
- [ ] Update WHERE clause parsing to use outer scope
- [ ] Update SELECT list parsing to use outer scope
- [ ] Update subquery parsing to receive outer scope

#### Step 3.3: Update Resolver Implementation

- [ ] Implement outer scope resolution in ResolveExpressionAST
- [ ] Handle scope shadowing in column resolution
- [ ] Update qualified column resolution
- [ ] Update unqualified column resolution
- [ ] Test: Run typecheck, should have fewer errors

#### Step 3.4: Fix Remaining Type Errors

- [ ] Address any remaining TypeScript errors
- [ ] Verify type inference works correctly
- [ ] Test: Run `npm run typecheck:test` - should pass

### Phase 4: Testing (Priority 3)

**Goal:** Add comprehensive test coverage

#### Step 4.1: Create Success Tests

- [ ] Add select-correlated-subquery-exists.success.test.ts
- [ ] Add select-correlated-subquery-scalar.success.test.ts
- [ ] Add select-correlated-subquery-in.success.test.ts
- [ ] Add select-correlated-subquery-scope-shadowing.success.test.ts
- [ ] Test: Run tests, verify they pass

#### Step 4.2: Create Error Tests

- [ ] Add select-correlated-subquery-unknown-outer-column.error.test.ts
- [ ] Add select-correlated-subquery-type-mismatch.error.test.ts
- [ ] Add select-correlated-subquery-ambiguous-column.error.test.ts
- [ ] Test: Run tests, verify error messages are correct

#### Step 4.3: Verify Regression Tests

- [ ] Run full test suite
- [ ] Verify all existing subquery tests still pass
- [ ] Fix any broken tests
- [ ] Test: `npm test` - all tests should pass

### Phase 5: Documentation and Cleanup (Priority 4)

**Goal:** Document the feature and clean up

#### Step 5.1: Update Documentation

- [ ] Update SUPPORTED-SQL.md with correlated subquery section
- [ ] Document scope rules and shadowing behavior
- [ ] Note LATERAL exclusion
- [ ] Add examples

#### Step 5.2: Update TODO

- [ ] Mark correlated subquery item as complete in TODO.md
- [ ] Verify LATERAL remains as deferred item
- [ ] Update any related TODO items

#### Step 5.3: Edge Case Verification

- [ ] Test multiple nesting levels
- [ ] Test correlation in SELECT list
- [ ] Test correlation in WHERE clause
- [ ] Test qualified vs unqualified references
- [ ] Test: All edge cases work correctly

#### Step 5.4: Final Verification

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck:full` - 0 errors
- [ ] Run `npm run format:check` - no formatting issues
- [ ] Review git diff - changes look correct

#### Step 5.5: Commit and Mark Complete

- [ ] Commit all changes with clear commit message
- [ ] Update this status document with completion date
- [ ] Mark feature as complete

---

## Progress Tracking

**Started:** Not started  
**Last Updated:** 2026-05-09 16:50  
**Status:** 📋 Planning

**Completed Steps:**

None yet.

**Current Status:**

- 📋 Feature plan created
- ⏸️ Awaiting start

**Next Steps:**

1. Launch planning subagent to research current implementation
2. Review findings and refine plan
3. Begin implementation

**Summary:**

Feature plan created following workflow template. Ready to begin implementation when requested.

---

## Workflow Retrospective

**MANDATORY:** After completing this feature, perform a retrospective on your workflow adherence.

**This section must be completed before marking the feature as done.**

### What went well:

- [To be filled after feature completion]

### What could be improved:

- [To be filled after feature completion]
- **CRITICAL checks:**
    - Did I create this feature plan BEFORE starting implementation? [Yes]
    - Did I add "READ .workflow/ first" directive at the top? [Yes]
    - Did I update checkboxes during work, not just at end? [TBD]
    - Did I complete this retrospective section? [TBD]
    - If No to any: What would have prevented this deviation?

### CRITICAL: What in the workflow could be done better keeping in mind this feature?

- [To be filled after feature completion]

### Workflow doc improvements needed:

- [To be filled after feature completion]

### Actions taken:

- [ ] Updated `.workflow/README.md` with clarifications
- [ ] Updated `.workflow/findings.md` with new patterns
- [ ] Updated `.workflow/feature_template.md` if needed

**This retrospective makes the workflow clearer for future work!**
