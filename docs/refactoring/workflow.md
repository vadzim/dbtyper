# Feature/Refactoring Planning & Knowledge Workflow

**This document serves two purposes:**
1. **Feature Planning Workflow** - Structure for planning specific features/refactorings
2. **Project Knowledge Base** - Accumulated learnings that apply to all work

---

# Part 1: Project Knowledge Base

**Writing down findings during feature development improves your experience and capabilities in developing next features.**

## 🔄 Continuous Update Workflow - CRITICAL FOR AGENTS

**When working on ANY feature, you MUST update TWO documents continuously:**

### 1. Feature-Specific Plan (e.g., `docs/refactoring/feature-name.md`)

Update this for feature-specific progress:
- ✅ Mark checkboxes as tasks complete
- 📝 Track what you've done in this session
- ⚠️ Document blockers or issues specific to this feature
- 📊 Update progress tracking and next steps
- 🎯 Feature-specific decisions and temporary workarounds

**Update frequency:** After completing each significant step or task

### 2. This Workflow Document (`docs/refactoring/workflow.md`)

Update this when you discover GENERAL knowledge:
- 🏗️ **Project conventions** - Patterns that apply to all features
- 🔧 **Tool usage** - Commands, build tools, how things work
- 🧠 **Architecture insights** - How the system is structured
- 💡 **Solutions to common problems** - Pitfalls and how to avoid them
- ⚡ **Workflow patterns** - What works well (like using subagents)
- 🐛 **Debugging techniques** - TypeScript tricks, investigation methods

**Update frequency:** Immediately when you discover something reusable

### Decision Tree: Which Document to Update?

Ask yourself: **"Will this help with OTHER features, or just THIS one?"**

- **Helps other features** → Update `workflow.md`
  - Example: "TypeScript type debugging technique"
  - Example: "Subagents work well for batch migrations"
  - Example: "Infrastructure tests catch issues early"

- **Only for this feature** → Update feature plan
  - Example: "Completed migration of 10 INSERT test files"
  - Example: "Blocked on understanding error message format"
  - Example: "Next: migrate UPDATE test files"

### Why This Matters

- **For you:** Build knowledge that makes future work faster
- **For others:** Share learnings so they don't repeat your work
- **For the project:** Create a living knowledge base that grows over time

**Remember: Update BOTH documents throughout development, not just at the end!**

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

## Workflow Efficiency

### ✅ What Worked Well

1. **Using subagents for parallel batch processing**
   - Saved significant time (2 hours vs estimated 6-7 hours)
   - Each subagent worked independently on different file groups
   - Clear instructions with reference examples led to consistent results

2. **Infrastructure tests caught inconsistencies immediately**
   - Validation rules enforced the pattern
   - Failed fast when files didn't match expected format

3. **Type system provided instant feedback**
   - Wrong error messages caught at compile time
   - No need to run tests to verify error message correctness

4. **Incremental approach**
   - Started with one example file
   - Validated the approach before scaling
   - Fixed issues early before they multiplied

### ⚠️ Challenges Encountered

1. **Type instantiation depth required fundamental approach change**
   - Initial approach failed completely
   - Needed to investigate and understand the root cause
   - Solution required different mental model (inline shapes vs runtime types)

2. **Error messages weren't always what was expected**
   - Had to investigate actual error strings in parser source
   - Context-specific messages (DELETE vs UPDATE vs INSERT)
   - Required iteration and fixes after initial migration

3. **Infrastructure validation regex needed multiple iterations**
   - Pattern matching for `@ts-expect-error` placement was tricky
   - Had to account for different query call patterns (query/stream/apply)
   - Blank lines and comments caused validation failures

4. **Some files had subtle formatting differences**
   - Blank lines between `@ts-expect-error` and query call
   - Comments in unexpected places
   - Required cleanup pass after initial migration

### 📊 Time Estimate vs Reality

- **Plan estimated:** 6-7 hours
- **Actual:** ~2 hours with heavy subagent usage
- **Key factor:** Subagents handled the tedious repetitive work efficiently

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

## Questions for Future Investigation

1. Could the type instantiation depth issue be solved at the source?
   - Maybe flatten database types earlier in the chain?
   - Would it be worth the complexity?

2. Could error message extraction be simplified?
   - Is there a way to avoid recreating database shapes?
   - Could we cache or memoize type-level operations?

3. Should we add more infrastructure tests?
   - Validate error message format consistency?
   - Check for common error message typos?

4. Could subagent usage be further optimized?
   - More granular batching?
   - Better error recovery?

---

## Resources & References

- **Test utilities:** `test/test-utils/error-test-utils.ts`
- **Infrastructure tests:** `test/infra/integration-file-naming.test.ts`
- **Parser source:** `src/parser/parse-sql-statement.ts`
- **Error types:** `src/sql-parser-error.ts`
- **Database types:** `src/core/sql-database.ts`

---

## Feature Planning Template


---

## Feature Planning Template

When planning a specific feature/refactoring, create a new document (e.g., `docs/refactoring/feature-name.md`) with:

- **Overview** - What and why
- **Migration Status** - What's done, what's not
- **Current Test Failures** - Error patterns and causes
- **What Needs to Be Done** - Prioritized tasks with estimates
- **Migration Strategy** - Phased approach
- **Technical Challenges** - Problems and solutions
- **Testing Strategy** - What to test
- **Success Criteria** - Checkboxes for completion
- **Detailed TODO Checklist** - Step-by-step tasks with checkboxes
- **Progress Tracking** - Current status and next steps
- **Migration Completion Summary** - Final results

**See `docs/refactoring/error-message-checking.md` for a complete example.**

**Remember:** Update the general knowledge sections above in this workflow.md when you discover something that applies beyond your specific feature!

