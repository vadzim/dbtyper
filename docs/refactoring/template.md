# Feature/Refactoring Planning & Knowledge Template

**This document serves two purposes:**
1. **Feature Planning Template** - Structure for planning specific features/refactorings
2. **Project Knowledge Base** - Accumulated learnings that apply to all work

---

# Part 1: Project Knowledge Base

**Writing down findings during feature development improves your experience and capabilities in developing next features.**

## 🔄 Continuous Update Workflow

**IMPORTANT: Update this section throughout feature development, not just at the end!**

When you discover something during feature work that belongs to:
- **Project domain** (architecture, conventions, patterns)
- **Tools domain** (build tools, test runners, CLI commands)
- **General knowledge** (not specific to the current feature)

→ **Update this template immediately**, not just the feature-specific sections below.

### Why Update During Development?

1. **Capture insights while fresh** - Don't wait until the end when details fade
2. **Build knowledge incrementally** - Each discovery adds to the collective understanding
3. **Help future work immediately** - Next feature can benefit from today's learning
4. **Avoid duplication** - Don't rediscover the same things repeatedly

### What Goes Where?

**Part 1 (Project Knowledge Base)** - This section:
- Project conventions and patterns (applies to ALL features)
- Tool usage and commands (reusable knowledge)
- Architecture insights (helps understand the system)
- Common pitfalls and solutions (avoid repeating mistakes)
- Workflow patterns that worked well (process improvements)

**Part 2 (Feature Planning)** - Sections below:
- Implementation steps for THIS specific feature
- Progress tracking and checkboxes
- Feature-specific decisions and blockers
- Temporary workarounds for this feature

---

## Project Structure & Organization

**Test Organization:**
- Well-organized test structure: `test/integration/{operation-type}/*.test.ts`
- Clear naming convention: `{operation}-{scenario}.{success|error}.test.ts`
- 74 error test files across INSERT, UPDATE, DELETE, SELECT, DDL, query-stream, and expressions
- Infrastructure tests enforce consistency across all test files

**Codebase Architecture:**
- Type-level SQL parser that validates queries at compile time
- Parser returns tuples: `[NewDbShape, Tokens, Error]`
- Database shapes flow through migrations using `ApplyStatements`
- `FlattenedJsqlDatabase` wrappers create deeply nested types from chained `.apply()` calls

---

## TypeScript Type System Challenges

**Type Instantiation Depth Issues:**
- ❌ Initial approach using `typeof db` hit "Type instantiation is excessively deep" errors
- 🔍 Root cause: Chained `.apply()` calls create deeply nested `FlattenedJsqlDatabase` types
- ✅ Solution: Use inline database shapes with `ApplyStatements<SqlDatabase, \`...\`>[0]` instead
- 💡 Pattern matching (`extends [infer A, infer B]`) works better than indexed access (`[1]`)

**Error Message Extraction:**
- Can't extract errors directly from runtime database types
- Must recreate database shape at type level for error checking
- `ParseSqlStatement` works on clean shapes, not nested runtime types

**Debugging TypeScript Types:**

When you need to see what a complex type actually resolves to, use this technique:

```typescript
const _n: never = 1 as unknown as SomeComplexType<Args>
```

Then run `npm run typecheck:test` and TypeScript will show you the actual resolved type in the error message:
```
Type 'SomeComplexType<Args>' is not assignable to type 'never'.
  Type 'SqlParserError<"Unknown table in DELETE FROM">' is not assignable to type 'never'.
```

**If TypeScript hides the implementation** (shows type alias instead of expanded type), use this:

```typescript
const _n: never = 1 as unknown as {[K in keyof T]: T[K]}
```

This forces TypeScript to expand and show the full structure of the type, not just its name.

**Why these work:**
- `never` type accepts no values
- TypeScript shows what type you're trying to assign to it
- Forces TypeScript to fully resolve and display the type
- Mapped type `{[K in keyof T]: T[K]}` forces expansion of type aliases

**Example:**
```typescript
// To see what error ExtractQueryError returns:
const _n: never = 1 as unknown as ExtractQueryError<DbShape, typeof query>

// TypeScript error shows:
// Type 'SqlParserError<"Unknown table in DELETE FROM">' is not assignable to type 'never'
// Now you know the exact error message to use in your test

// If you need to see the full structure of SqlParserError:
const _n2: never = 1 as unknown as {[K in keyof SqlParserError<"Unknown table">]: SqlParserError<"Unknown table">[K]}
```

After you get the information, remove the debug line.

**Key Lesson:** When working with complex type-level operations, avoid deeply nested runtime types. Create clean type-level representations instead.

---

## Build & Test Tools

**Test Runner:**
- Uses Node.js built-in test runner (`node --test`)
- Fast execution: ~2.8 seconds for 2368 tests
- 345 test suites organized hierarchically

**Type Checking:**
- Custom tool: `tsgo` (faster TypeScript compiler)
- Separate configs: `tsconfig.json`, `tsconfig.test.json`
- `monadcheck-log` - custom tool that logs to `.logs/*.7z` archives
- Type checking is very fast: ~0.8 seconds

**Linting:**
- ESLint with strict rules
- Enforces unused variable naming convention: must start with `_`

**CI/CD:**
- Full test suite includes: typecheck, test, lint, find-unused, format:check
- Workspaces: `@dbtyper/example-postgres`, `@dbtyper/example-nest-postgres`, `dbtyper-nest`
- `TEST_MIGRATIONS=1` environment variable for migration tests

**Commands to Remember:**
```bash
npm run typecheck:test          # Fast type checking for tests only
npm run typecheck:full          # Full type checking including examples
npm test                        # Full test suite (includes lint)
TEST_MIGRATIONS=1 node --test "test/**/*.test.ts"  # Tests only, no lint
```

---

## Git Workflow

**Worktree Setup:**
- Working in `.worktrees/{branch-name}` directory
- Clean separation from main working directory

**PR Process:**
- GitHub CLI (`gh`) for PR creation and management
- Automerge available but squash merging disabled on repo
- Use merge strategy instead
- Commands:
  ```bash
  gh pr create --title "..." --body "$(cat <<'EOF' ... EOF)" --base main
  gh pr merge {number} --auto --merge
  gh pr view {number}
  ```

---

## Development Patterns

**Type Testing:**
- `Expect<Matches<A, B>>` pattern for compile-time assertions
- Type tests run alongside runtime tests
- Infrastructure tests validate test file patterns

**Error Testing Philosophy:**
- Use type-level validation with `ExtractQueryError` (enforced)
- Makes error messages part of the API contract
- Infrastructure tests enforce the pattern

**Code Generation/Migration:**
- Use subagents extensively for batch migrations
- Parallel execution: 4+ subagents processing different file groups simultaneously
- Each subagent handles 5-20 files independently
- Very effective for repetitive transformations

**Pattern for Batch Migrations:**
1. Create one example manually to establish the pattern
2. Launch multiple subagents in parallel for different batches
3. Each subagent gets clear instructions with the reference example
4. Run tests after each batch to catch issues early
5. Fix any issues found and iterate

---

## Interesting Technical Details

**SQL Parser Implementation:**
- Lexer: `ParseSqlTokens` tokenizes SQL strings
- Parser: `ParseSqlStatement` validates against database shape
- Returns error as third tuple element: `[Tokens, DbShape, Error]`
- Error messages are context-specific (e.g., "Unknown table in DELETE FROM")

**Stream Validation:**
- Different validation layer than query validation
- Uses `SqlSelectRow` instead of `ExtractQueryError`
- Checks for RETURNING clause at different type level

**Mock Driver:**
- `mockDriver` for testing without actual database
- Scalar types configurable per test
- Allows pure type-level testing

---

## Key Takeaways for Future Work

1. **Always investigate before scaling**
   - Test approach with one example first
   - Understand type system limitations early
   - Don't assume the obvious approach will work

2. **Use subagents for repetitive tasks**
   - Launch multiple in parallel for different batches
   - Provide clear instructions with reference examples
   - Let them handle the tedious work while you orchestrate

3. **Infrastructure tests are invaluable**
   - Enforce patterns automatically
   - Catch inconsistencies immediately
   - Make refactoring safer

4. **Type-level programming requires different thinking**
   - Runtime types ≠ type-level types
   - Avoid deeply nested types in type-level operations
   - Pattern matching often better than indexed access

5. **Document error messages explicitly**
   - Makes them part of the API contract
   - Prevents accidental changes
   - Improves test clarity

6. **Context-specific error messages are better**
   - "Unknown table in DELETE FROM" vs generic "Unknown table"
   - Helps users understand where the error occurred
   - Worth the extra complexity

---

## Project-Specific Conventions to Remember

1. **Unused variables must start with `_`**
   - ESLint enforces this strictly
   - Use `_errorCheck`, `_debug`, etc.

2. **Test file naming is strict**
   - `{operation}-{scenario}.{success|error}.test.ts`
   - Infrastructure tests validate this

3. **Error test pattern is enforced**
   - Must have `const query = \`...\` as const`
   - Must have `@ts-expect-error` immediately before query call
   - Must have `ExtractQueryError` type check

4. **Type-level database shapes**
   - Use `ApplyStatements<SqlDatabase, \`...\`>[0]` for clean shapes
   - Don't use `typeof db` for type-level operations
   - Recreate schema inline for error checking

5. **Stream tests are different**
   - Use `SqlSelectRow` for validation
   - Different error checking layer than query tests

---

## Resources & References

- **Test utilities:** `test/test-utils/error-test-utils.ts`
- **Infrastructure tests:** `test/infra/integration-file-naming.test.ts`
- **Parser source:** `src/parser/parse-sql-statement.ts`
- **Error types:** `src/sql-parser-error.ts`
- **Database types:** `src/core/sql-database.ts`

---

# Part 2: Feature Planning Template

Use this section for planning specific features/refactorings. Copy and fill in the sections below.

---

# [Feature/Refactoring Name] Status

**Date:** YYYY-MM-DD HH:MM  
**Current State:** [Brief description of current state]

## Overview

[Brief description of what this refactoring/feature is about and why it's needed]

## Migration Status

### ✅ Completed (Working)

1. **[Component/Area Name]** (`path/to/file.ts`)
    - [What was done]
    - [What was done]
    - [What was done]

2. **[Component/Area Name]** (`path/to/file.ts`)
    - [What was done]
    - [What was done]

### ❌ Incomplete (Causing Failures)

1. **[Component/Area Name]** (`path/to/file.ts`)
    - **Problem:** [Description of the problem]
    - **Impact:** [How this affects the system]
    - **Proper fix needed:** [What needs to be done]

2. **[Component/Area Name]** (`path/to/file.ts`)
    - **Problem:** [Description of the problem]
    - **Impact:** [How this affects the system]

## Current Test Failures

**Total errors:** [Number] TypeScript compilation errors

**Main error patterns:**

1. **[Error Category]:**

    ```
    [Example error message]
    ```

    - Cause: [Why this error occurs]

2. **[Error Category]:**

    ```
    [Example error message]
    ```

    - Cause: [Why this error occurs]

## What Needs to Be Done

### Priority 1: [Task Name]

**Goal:** [What this task aims to achieve]

**Files to update:**

- `path/to/file.ts` (main work)
    - [Specific change needed]
    - [Specific change needed]
    - [Specific change needed]

**Approach:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Estimated effort:** [Time estimate]

### Priority 2: [Task Name]

**Goal:** [What this task aims to achieve]

**Why this is important:**

- [Reason 1]
- [Reason 2]
- [Reason 3]

**Files to update:**

- `path/to/file.ts`
    - [Specific change needed]

**Estimated effort:** [Time estimate]

### Priority 3: [Task Name]

**Goal:** [What this task aims to achieve]

**Files to update:**

- `path/to/file.ts`
    - [Specific change needed]

**Estimated effort:** [Time estimate]

## Migration Strategy

### Recommended Approach: [Approach Name]

1. **Phase 1: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

2. **Phase 2: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

3. **Phase 3: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

### Alternative Approach: [Approach Name]

1. **[Alternative approach description]**
    - Higher risk of [risk]
    - Faster if successful
    - Harder to debug if issues arise

**Recommendation:** [Which approach to use and why]

## Technical Challenges

### Challenge 1: [Challenge Name]

**Problem:** [Description of the challenge]

**Solution:**

- [Solution approach 1]
- [Solution approach 2]
- [Solution approach 3]

### Challenge 2: [Challenge Name]

**Problem:** [Description of the challenge]

**Current state:** [How it's currently handled]

**Future state:** [How it should be handled after migration]

## Testing Strategy

1. **Unit tests:** [What to test at unit level]
2. **Integration tests:** [What to test at integration level]
3. **Regression tests:** [What to verify hasn't broken]
4. **Type tests:** [What to verify about type inference]

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Criterion 4]
- [ ] [Criterion 5]

## Timeline Estimate

- **Priority 1:** [Time estimate] ([description])
- **Priority 2:** [Time estimate] ([description])
- **Priority 3:** [Time estimate] ([description])
- **Priority 4:** [Time estimate] ([description])

**Total:** [Total time estimate] of focused work

## Notes

- [Important note 1]
- [Important note 2]
- [Important note 3]

## Current Workarounds (Temporary)

These are temporary bridges that should be removed once migration is complete:

1. **[Workaround Name]** in `path/to/file.ts`
    - [What it does]
    - [Why it's needed]
    - **Remove after:** [When to remove it]

2. **[Workaround Name]** in `path/to/file.ts`
    - [What it does]
    - [Why it's needed]
    - **Remove after:** [When to remove it]

## Related Files

- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]
- `path/to/file3.ts` - [Description]

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
8. **Update Part 1 (Project Knowledge)** - When you discover something that applies beyond this feature, update Part 1 immediately

This ensures the plan is always up-to-date and can be resumed at any time.

---

### Phase 1: [Phase Name] (Priority 1)

**Goal:** [What this phase aims to achieve]

#### Step 1.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]
- [ ] [Task 4]

**Notes:** [Any important notes about this step]

#### Step 1.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

#### Step 1.3: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]
- [ ] Test: [What to test]

### Phase 2: [Phase Name] (Priority 2)

**Goal:** [What this phase aims to achieve]

#### Step 2.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

#### Step 2.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: [Phase Name] (Priority 3)

**Goal:** [What this phase aims to achieve]

#### Step 3.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 3.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] Test: [What to test]

### Phase 4: [Phase Name] (Priority 4)

**Goal:** [What this phase aims to achieve]

#### Step 4.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 4.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 4.3: Run Full Test Suite

- [ ] Run `npm test` - should pass all tests
- [ ] Fix any remaining test failures
- [ ] Verify 0 TypeScript compilation errors

### Phase 5: Cleanup and Documentation (Final)

#### Step 5.1: Remove Temporary Code

- [ ] Remove all `// TODO: remove after migration` comments
- [ ] Remove any other temporary workarounds
- [ ] Clean up any dead code

#### Step 5.2: Update Documentation

- [ ] Update `SUPPORTED-SQL.md` if needed
- [ ] Update `README.md` if needed
- [ ] Add entry to `LOG.md` documenting the migration
- [ ] Mark this TODO document as complete

#### Step 5.3: Performance Check

- [ ] Measure TypeScript compilation time before/after
- [ ] Verify no significant performance regression
- [ ] If performance issues, optimize type nesting

#### Step 5.4: Final Verification

- [ ] Run `npm test` - all tests pass
- [ ] Run `npx tsc --noEmit` - 0 errors
- [ ] Run `npm run format:check` - no formatting issues
- [ ] Review git diff - changes look correct

#### Step 5.5: Commit and Document

- [ ] Commit all changes with clear commit message
- [ ] Update this status document with completion date
- [ ] Archive or mark as complete

---

## Progress Tracking

**Started:** YYYY-MM-DD  
**Last Updated:** YYYY-MM-DD HH:MM  
**Status:** [🔄 In Progress | ✅ Completed | ⚠️ Blocked]

**Completed Steps:**

- ✅ [Step description] (completed YYYY-MM-DD HH:MM)
- ✅ [Step description] (completed YYYY-MM-DD HH:MM)
- ✅ [Step description] (completed YYYY-MM-DD HH:MM)

**Current Status:**

- ✅ [Achievement 1]
- ✅ [Achievement 2]
- ⚠️ [Issue or blocker]

**What Was Done ([Date] [Time] - [Time]):**

1. [Change 1]
2. [Change 2]
3. [Change 3]

**Remaining Issues:**

1. **[Issue category] ([number] errors):**
    - [Specific issue 1]
    - [Specific issue 2]

**Root Cause Analysis:**
[Analysis of what's causing the remaining issues]

**Next Steps:**

1. [Next step 1] (highest priority)
2. [Next step 2]
3. [Next step 3]

**Summary:**
[Brief summary of current state and what's been accomplished]

---

## Migration Completion Summary

**Completion Date:** YYYY-MM-DD HH:MM  
**Total Time:** [Duration]

### What Was Accomplished

[High-level summary of what was achieved]

### Key Changes Made

1. **[Change category]** (file paths):
    - [Specific change 1]
    - [Specific change 2]
    - [Impact of changes]

2. **[Change category]** (file paths):
    - [Specific change 1]
    - [Specific change 2]
    - [Impact of changes]

### Test Results

- **Total tests:** [Number]
- **Passing:** [Number] ([Percentage]%)
- **Failing:** [Number]
- **TypeScript errors:** [Number]
- **Monadcheck errors:** [Number]

### Benefits Achieved

1. **[Benefit 1]:** [Description]
2. **[Benefit 2]:** [Description]
3. **[Benefit 3]:** [Description]
4. **[Benefit 4]:** [Description]
5. **[Benefit 5]:** [Description]

### Files Modified

- `path/to/file1.ts` - [What was changed]
- `path/to/file2.ts` - [What was changed]
- `path/to/file3.ts` - [What was changed]

### Migration Complete ✅

All success criteria met:

- ✅ [Criterion 1]
- ✅ [Criterion 2]
- ✅ [Criterion 3]
- ✅ [Criterion 4]
- ✅ [Criterion 5]

### Learnings to Add to Part 1

**Remember to update Part 1 (Project Knowledge Base) with any general learnings from this feature!**

- [Learning 1 that applies to future work]
- [Learning 2 that applies to future work]
- [Learning 3 that applies to future work]
