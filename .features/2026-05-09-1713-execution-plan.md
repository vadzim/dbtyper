# High-Level Execution Plan: Correlated Subqueries + Array Operations MVP

**Date:** 2026-05-09 17:13  
**Current Time:** 5:13 PM  
**Status:** Planning Phase

---

## Overview

This document provides a high-level execution plan for implementing two features sequentially:

1. **Feature A: Correlated Subqueries** (4.5-6.5 hours)
2. **Feature B: Array Operations MVP** (6-9 hours)

**Total estimated time:** 10.5-15.5 hours

**Current state:**

- Branch: `dev`
- Working tree: clean
- Last commit: `417eb75 Add feature plans for correlated subqueries and array operations MVP`

---

## Timeline and Session Breakdown

### Session 1: NOW - ~2 hours (5:13 PM - 7:13 PM)

**Focus:** Start Feature A - Correlated Subqueries

**Goals:**

- Complete Phase 1: Research and Planning (30-45 min)
- Begin Phase 2: Type Signatures and Scope Threading (1-1.5 hours)

**Natural stopping points:**

- After Phase 1 complete (research done, plan refined)
- Mid-Phase 2 (type signatures updated, compilation errors expected)

**Deliverables:**

- Research findings documented
- Type signatures updated
- Feature plan updated with progress
- Commit: "WIP: Add outer scope type signatures for correlated subqueries"

---

### Session 2: ~2-3 hours

**Focus:** Complete Feature A - Correlated Subqueries

**Goals:**

- Complete Phase 2: Scope Threading Implementation
- Phase 3: Comprehensive Testing
- Phase 4: Documentation

**Natural stopping points:**

- After implementation complete, before testing
- After testing complete, before documentation

**Deliverables:**

- Correlated subqueries fully implemented
- All tests passing
- Documentation updated
- Commit: "Implement correlated subqueries with outer scope threading"
- Push to remote

---

### Session 3: ~2-3 hours

**Focus:** Start Feature B - Array Operations MVP

**Goals:**

- Phase 1: Research and Planning (30-45 min)
- Phase 2: Array Literals Implementation (2-3 hours)

**Natural stopping points:**

- After Phase 1 complete (research done)
- After array literals working with basic tests

**Deliverables:**

- Research findings documented
- Array literal parsing and resolution implemented
- Basic tests passing
- Feature plan updated
- Commit: "Implement array literal syntax (ARRAY[...])"

---

### Session 4: ~2-3 hours

**Focus:** Continue Feature B - Array Operators

**Goals:**

- Phase 3: Array Operator Implementation (1-2 hours)
- Phase 4: Array Indexing (if feasible, 1-2 hours)

**Natural stopping points:**

- After operator implementation complete
- After indexing assessment (implement or defer)

**Deliverables:**

- Array containment operator (@>) implemented
- Array indexing implemented or deferred
- Tests passing for implemented features
- Commit: "Add array containment operator and indexing support"

---

### Session 5: ~2-3 hours

**Focus:** Complete Feature B - Testing and Documentation

**Goals:**

- Phase 5: Comprehensive Testing (1-2 hours)
- Phase 6: Documentation and Cleanup (30 min)
- Final verification

**Natural stopping points:**

- After all tests passing
- After documentation complete

**Deliverables:**

- Full test coverage for array operations
- Documentation updated
- All tests passing, 0 TypeScript errors
- Commit: "Complete array operations MVP with tests and documentation"
- Push to remote

---

## Feature A: Correlated Subqueries (4.5-6.5 hours)

### Phase 1: Research and Planning (30-45 min)

**Subagent Task:**

- Research current subquery implementation
- Map scope threading points
- Identify type signatures to update
- Review existing subquery tests

**Main Agent:**

- Review subagent findings
- Refine implementation plan
- Create test plan

**Deliverable:** Detailed implementation approach documented

---

### Phase 2: Type Signatures and Implementation (2-3 hours)

**Tasks:**

1. Add `OuterScope` type parameter to parser types
2. Thread through call chain (ParseSelect, ParseExpression, etc.)
3. Update resolver types
4. Implement scope merging logic (inner shadows outer)
5. Implement scope resolution in parser and resolver
6. Fix TypeScript compilation errors

**Verification:**

- `npm run typecheck:test` passes
- No compilation errors

**Deliverable:** Scope threading fully implemented

---

### Phase 3: Comprehensive Testing (1-2 hours)

**Test Files to Create:**

- `select-correlated-subquery-exists.success.test.ts`
- `select-correlated-subquery-scalar.success.test.ts`
- `select-correlated-subquery-in.success.test.ts`
- `select-correlated-subquery-scope-shadowing.success.test.ts`
- `select-correlated-subquery-unknown-outer-column.error.test.ts`
- `select-correlated-subquery-type-mismatch.error.test.ts`

**Verification:**

- All new tests pass
- All existing tests still pass
- `npm test` passes

**Deliverable:** Full test coverage

---

### Phase 4: Documentation (30 min - 1 hour)

**Tasks:**

1. Update `docs/SUPPORTED-SQL.md` with correlated subquery section
2. Update `TODO.md` - mark item complete
3. Add examples and scope rules documentation
4. Final verification and commit

**Verification:**

- `npm test` passes
- `npm run typecheck:full` passes
- `npm run format:check` passes

**Deliverable:** Feature complete and documented

---

## Feature B: Array Operations MVP (6-9 hours)

### Phase 1: Research and Planning (30-45 min)

**Subagent Task:**

- Research current array type implementation
- Identify where to add array literal parsing
- Identify where to add operator parsing
- Assess indexing feasibility
- Review existing array function tests

**Main Agent:**

- Review subagent findings
- Decide on MVP scope (which operator, whether to include indexing)
- Create detailed test plan

**Deliverable:** Detailed implementation approach documented

---

### Phase 2: Array Literals (2-3 hours)

**Tasks:**

1. Add lexer support for `[` and `]` tokens (if needed)
2. Implement array literal parsing in `ParseScalarExprUntyped`
3. Parse `ARRAY[expr1, expr2, ...]` syntax
4. Create array literal AST node
5. Implement array literal resolution in `ResolveExpressionAST`
6. Implement type unification for array elements
7. Add basic tests

**Verification:**

- Array literals parse correctly
- Type inference works
- Basic tests pass
- `npm run typecheck:test` passes

**Deliverable:** Array literal syntax working

---

### Phase 3: Array Operator (1-2 hours)

**Tasks:**

1. Add `@>` operator to operator list
2. Add to operator precedence table
3. Parse as binary operator
4. Implement operator resolution
5. Type check: both sides must be compatible arrays
6. Return boolean type
7. Add tests

**Verification:**

- Operator parses correctly
- Type checking works
- Tests pass

**Deliverable:** Array containment operator working

---

### Phase 4: Array Indexing (1-2 hours, optional)

**Decision Point:** Assess complexity

**If feasible:**

1. Add postfix `[expr]` parsing
2. Create indexing AST node
3. Implement indexing resolution
4. Check base is array, index is integer
5. Return element type
6. Add tests

**If too complex:**

- Document decision to defer
- Add to backlog in TODO.md
- Skip to Phase 5

**Deliverable:** Indexing implemented or deferred with rationale

---

### Phase 5: Comprehensive Testing (1-2 hours)

**Test Files to Create:**

- `select-array-literal.success.test.ts`
- `select-array-contains.success.test.ts`
- `select-array-indexing.success.test.ts` (if implemented)
- `select-array-literal-type-mismatch.error.test.ts`
- `select-array-contains-type-mismatch.error.test.ts`
- Integration tests with existing array functions

**Verification:**

- All new tests pass
- All existing tests still pass
- Regression tests for existing array functions pass
- `npm test` passes

**Deliverable:** Full test coverage

---

### Phase 6: Documentation and Cleanup (30 min)

**Tasks:**

1. Update `docs/SUPPORTED-SQL.md` with array operations section
2. Document `ARRAY[...]` syntax
3. Document supported operators
4. Document indexing (if implemented)
5. Note what is NOT supported (deferred items)
6. Update `TODO.md` - mark MVP complete, keep deferred items
7. Final verification and commit

**Verification:**

- `npm test` passes
- `npm run typecheck:full` passes
- `npm run format:check` passes

**Deliverable:** Feature complete and documented

---

## Subagent Usage Strategy

### When to Use Subagents

**Use subagents for:**

1. Research and planning phases (preserve main context)
2. Codebase exploration (understanding current implementation)
3. Parallel work (if multiple independent tasks)

**Don't use subagents for:**

1. Implementation work (main agent does this)
2. Testing (main agent runs tests)
3. Documentation updates (main agent writes docs)

### Subagent Tasks

**Feature A - Phase 1 Subagent:**

- Task: Research current subquery implementation
- Files: `parse-select.ts`, `parse-expression.ts`, `resolve-expression.ts`
- Output: Scope threading map, type signatures to update
- Duration: 15-20 minutes

**Feature B - Phase 1 Subagent:**

- Task: Research current array implementation
- Files: `sql-types.ts`, `parse-expression.ts`, `resolve-expression.ts`, `resolve-function-call.ts`
- Output: Array type structure, parsing entry points, operator integration approach
- Duration: 15-20 minutes

---

## Verification Strategy

### After Each Phase

1. **Run TypeScript compilation:**

    ```bash
    npm run typecheck:test
    ```

2. **Run tests:**

    ```bash
    npm test
    ```

3. **Check formatting:**
    ```bash
    npm run format:check
    ```

### Before Each Commit

1. All tests passing
2. No TypeScript errors
3. No formatting issues
4. Git diff reviewed

### Before Each Push

1. Full test suite passes
2. Full typecheck passes
3. Feature plan updated with completion status
4. Documentation updated

---

## Commit Strategy

### Feature A Commits

1. **After Phase 1:** "Plan correlated subqueries implementation"
2. **Mid-Phase 2:** "WIP: Add outer scope type signatures for correlated subqueries"
3. **After Phase 2:** "Implement outer scope threading for correlated subqueries"
4. **After Phase 3:** "Add comprehensive tests for correlated subqueries"
5. **After Phase 4:** "Document correlated subqueries support"

**Final commit message:**

```
Implement correlated subqueries with outer scope threading

- Add OuterScope parameter to parser and resolver types
- Thread outer scope through ParseSelect and ParseExpression
- Implement scope merging logic (inner shadows outer)
- Add comprehensive test coverage
- Update documentation

Closes TODO item: Implement correlated subqueries
```

### Feature B Commits

1. **After Phase 1:** "Plan array operations MVP implementation"
2. **After Phase 2:** "Implement array literal syntax (ARRAY[...])"
3. **After Phase 3:** "Add array containment operator (@>)"
4. **After Phase 4:** "Add array indexing support" (or "Defer array indexing to backlog")
5. **After Phase 5:** "Add comprehensive tests for array operations"
6. **After Phase 6:** "Document array operations MVP"

**Final commit message:**

```
Complete array operations MVP

- Implement ARRAY[...] literal syntax with type inference
- Add array containment operator (@>)
- Add array indexing support (or: Defer indexing to backlog)
- Add comprehensive test coverage
- Update documentation

Closes TODO item: PostgreSQL arrays MVP
```

---

## Risk Management

### Potential Blockers

**Feature A:**

1. **Type instantiation depth issues** - Adding OuterScope parameter might exceed TypeScript limits
    - Mitigation: Use same patterns as existing Params threading
    - Fallback: Simplify type structure if needed

2. **Scope shadowing complexity** - Inner/outer scope interaction might be tricky
    - Mitigation: Start with simple cases, add complexity incrementally
    - Fallback: Document limitations if full shadowing is too complex

3. **Breaking existing tests** - Scope changes might affect non-correlated subqueries
    - Mitigation: Run tests frequently, fix regressions immediately
    - Fallback: Make outer scope optional/empty by default

**Feature B:**

1. **Array type inference complexity** - Unifying heterogeneous element types
    - Mitigation: Start with simple cases (all same type)
    - Fallback: Require explicit type annotation if unification is too complex

2. **Operator precedence issues** - Array operators might conflict with existing operators
    - Mitigation: Research PostgreSQL precedence, test thoroughly
    - Fallback: Document known precedence limitations

3. **Indexing syntax ambiguity** - `[` could be literal or indexing
    - Mitigation: `ARRAY` keyword disambiguates literals
    - Fallback: Defer indexing if too complex

### Contingency Plans

**If Session 1 runs long:**

- Stop after Phase 1 complete (research done)
- Commit plan updates
- Resume with Phase 2 in Session 2

**If Feature A takes longer than expected:**

- Extend Session 2 by 1 hour
- Adjust Session 3 start time
- Feature B timeline remains the same

**If Feature B indexing is too complex:**

- Defer to backlog immediately
- Document decision in TODO.md
- Continue with testing and documentation

**If running out of time:**

- Prioritize Feature A completion (smaller, more critical)
- Feature B can be paused after any phase
- Each phase is committable/resumable

---

## Success Criteria

### Feature A Complete When:

- [ ] Outer columns accessible in subquery WHERE clauses
- [ ] Outer columns accessible in subquery SELECT expressions
- [ ] Scope shadowing works correctly
- [ ] All tests pass (existing + new)
- [ ] 0 TypeScript errors
- [ ] Documentation updated
- [ ] Committed and pushed

### Feature B Complete When:

- [ ] Array literals work with `ARRAY[...]` syntax
- [ ] Array containment operator (`@>`) works
- [ ] Array indexing works (or explicitly deferred)
- [ ] All tests pass (existing + new)
- [ ] 0 TypeScript errors
- [ ] Documentation updated
- [ ] Committed and pushed

### Overall Success:

- [ ] Both features implemented and tested
- [ ] All tests passing
- [ ] Documentation complete
- [ ] TODO.md updated
- [ ] Code pushed to remote
- [ ] Feature plans marked complete

---

## Progress Tracking

**Current Status:** 📋 Planning Complete

**Session 1 Status:** ⏸️ Not Started  
**Session 2 Status:** ⏸️ Not Started  
**Session 3 Status:** ⏸️ Not Started  
**Session 4 Status:** ⏸️ Not Started  
**Session 5 Status:** ⏸️ Not Started

**Feature A Status:** ⏸️ Not Started  
**Feature B Status:** ⏸️ Not Started

---

## Next Steps

**Immediate (Session 1):**

1. Launch subagent for Feature A Phase 1 research
2. Review findings and refine plan
3. Begin Phase 2 implementation
4. Update this plan with progress

**When to start:** When user says "go" or "start" or "begin"

---

## Notes

- This is a high-level orchestration plan
- Detailed checklists are in individual feature plans
- Update this plan as sessions progress
- Each session should end with a commit
- Natural stopping points allow for flexible scheduling
- Both features are independent and can be worked on separately
- Feature A is smaller and should complete first
- Feature B has optional components (indexing) that can be deferred

---

## Related Documents

- `.features/2026-05-09-1650-implement-correlated-subqueries.md` - Feature A detailed plan
- `.features/2026-05-09-1650-implement-array-operations-mvp.md` - Feature B detailed plan
- `TODO.md` - Overall project TODO list
- `docs/ROADMAP.md` - Project roadmap (Track D and Track E)
- `.workflow/README.md` - Workflow instructions
- `.workflow/project_knowledge.md` - Project-specific knowledge
- `.workflow/findings.md` - General development patterns

---

## Execution Plan Summary

| Session | Duration | Focus                                        | Deliverable                |
| ------- | -------- | -------------------------------------------- | -------------------------- |
| 1       | 2h       | Feature A: Research + Start Implementation   | Type signatures updated    |
| 2       | 2-3h     | Feature A: Complete Implementation + Testing | Feature A complete, pushed |
| 3       | 2-3h     | Feature B: Research + Array Literals         | Array literals working     |
| 4       | 2-3h     | Feature B: Operators + Indexing              | Operators working          |
| 5       | 2-3h     | Feature B: Testing + Documentation           | Feature B complete, pushed |

**Total: 10.5-15.5 hours across 5 sessions**

**Flexibility:** Each session has natural stopping points. Can pause/resume at any phase boundary.

**Resumability:** Each phase ends with a commit. Can resume from any commit point.

**Verification:** Tests run after each significant change. Full verification before each commit.

---

**Plan Status:** ✅ Complete and Ready to Execute

**Awaiting:** User instruction to begin Session 1
