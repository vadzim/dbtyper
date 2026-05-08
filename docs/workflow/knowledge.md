# Project Knowledge Base

**This document contains project-specific knowledge that applies to all features.**

Update this when you discover patterns, conventions, or insights specific to THIS project.

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

---

## Technical Details

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

## Project-Specific Conventions

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

**Key Lesson:** When working with complex type-level operations, avoid deeply nested runtime types. Create clean type-level representations instead.

---

## Resources & References

- **Test utilities:** `test/test-utils/error-test-utils.ts`
- **Infrastructure tests:** `test/infra/integration-file-naming.test.ts`
- **Parser source:** `src/parser/parse-sql-statement.ts`
- **Error types:** `src/sql-parser-error.ts`
- **Database types:** `src/core/sql-database.ts`

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
