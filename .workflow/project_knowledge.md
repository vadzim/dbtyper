# Project Knowledge Base

**This document contains project-specific knowledge that applies to all features.**

Update this when you discover patterns, conventions, or insights specific to THIS project.

**Part of the 5-document system:**

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge (THIS FILE)
4. .workflow/feature_template.md - Template for new features
5. .features/YYYY-MM-DD-HHMM-name.md - Current feature plan

---

## Project Structure & Organization

**Test Organization:**

- Well-organized test structure: `test/integration/{operation-type}/*.test.ts`
- Clear naming convention: `{operation}-{scenario}.{success|error}.test.ts`
- 74 error test files across INSERT, UPDATE, DELETE, SELECT, DDL, query-stream, and expressions
- Infrastructure tests enforce consistency across all test files
- Skipped tests use `.test.skip.ts` extension (e.g., `.error.test.skip.ts`)
- Skipped tests are excluded from TypeScript compilation but still validated by infrastructure tests
- Skipped tests must follow the same pattern as active tests (proper form required)

**Codebase Architecture:**

- Type-level SQL parser that validates queries at compile time
- Parser returns tuples: `[NewDbShape, Tokens, Error]`
- Database shapes flow through migrations using `ApplyStatements`
- `FlattenedJsqlDatabase` wrappers create deeply nested types from chained `.apply()` calls

**Error Code System:**

- Comprehensive error code registry with 357 unique codes
- Error codes are type-level (visible in IDE tooltips, not runtime)
- Registry location: `src/dbtyper-error.ts`
- Documentation: `docs/ERROR_CODES.md`
- **4-digit numbering scheme (1000-5499) with 100-code intervals:**
    - 1000-1099: Lexer/Tokenization (9 codes, 91 slots free)
    - 1100-1999: Parser Syntax (101 codes, 799 slots free)
    - 2000-2199: Validation (50 codes, 150 slots free)
    - 2200-2499: Resolution (29 codes, 271 slots free)
    - 2500-3199: Type System (40 codes, 660 slots free)
    - 3200-3699: Semantic/Constraints (59 codes, 441 slots free)
    - 3700-4199: DDL-Specific (32 codes, 468 slots free)
    - 4200-5099: DML/Expression (58 codes, 842 slots free)
    - 5100-5499: Type/Data Specific (39 codes, 361 slots free)
- Total: 357 codes used, ~3,400 slots available for future expansion
- Compile-time duplicate detection for both IDs and messages
- Format: `{ id: "SCREAMING_SNAKE_CASE", msg: ["message", "parts"] }`
- Adding new codes: Choose appropriate range, create unique ID, add to registry
- FormatError type formats errors as: `[dbt:CODE] message`

**Error Type Migration (Completed 2026-05-09):**

- ✅ All source code migrated from SqlParserError to FormatError
- **FormatError<ID, Args>** - Primary error constructor (use this for new code)
- **DbtyperError<Code, Message>** - Formatted error result type
- **SqlParserError<Message>** - Legacy alias (deprecated, kept for backward compatibility)
- Migration details: `.features/2026-05-08-2116-migrate-sqlparsererror-to-formaterror.md`

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
    - Applies to both active tests (`.test.ts`) and skipped tests (`.test.skip.ts`)
    - Infrastructure tests validate all test files, including skipped ones

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

## Automation System

**Location:** `.automation/` directory

**Architecture:**

- Complete automation system for implementing GitHub issues
- Uses git worktrees for isolation
- Polling-based monitoring (bash and TypeScript versions)
- Lock files in `.processing/` prevent duplicates
- Logs in `.automation/logs/`
- Configuration in `config.json` (example provided)

**Scripts:**

- `monitor-approved-issues.sh` - Bash monitoring script (original)
- `monitor-github-labels.ts` - TypeScript monitoring script (new)
- `auto-implement-issue.sh` - Main orchestrator (422 lines)
- `create-issue-worktree.sh` - Worktree management
- `cleanup-issue-worktree.sh` - Cleanup
- `create-issue-pr.sh` - PR creation

**TypeScript Automation Scripts:**

- First TypeScript automation script: `monitor-github-labels.ts`
- Pattern: Use `tsx` for direct TypeScript execution
- npm script pattern: `"monitor": "tsx .automation/monitor-github-labels.ts"`
- Can coexist with bash scripts
- Better for complex state management and error handling

**Documentation Pattern:**

- Each automation feature gets its own README
- Pattern: `.automation/FEATURE-README.md`
- Example: `MONITOR-README.md` for monitoring feature
- Comprehensive: usage, configuration, troubleshooting, architecture

**Integration Pattern:**

- TypeScript scripts can call bash scripts via spawn()
- Lock file management delegated to bash script (not duplicated)
- Pattern: TypeScript orchestrates, bash executes
- Clean separation of concerns

**Testing Automation Features:**

- Create real GitHub issue for testing
- Add label to trigger automation
- Verify behavior end-to-end
- Clean up test artifacts (issue, worktree, branch)
- Document testing in commit message

---

## Resources & References

- **Test utilities:** `test/test-utils/error-test-utils.ts`
- **Infrastructure tests:** `test/infra/integration-file-naming.test.ts`
- **Parser source:** `src/parser/parse-sql-statement.ts`
- **Error types:** `src/dbtyper-error.ts`
- **Database types:** `src/core/sql-database.ts`
- **Automation system:** `.automation/` directory
- **Automation docs:** `.automation/README.md`, `.automation/MONITOR-README.md`

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

4. How should incomplete/TODO tests be handled?
    - Current approach: Use `.test.skip.ts` extension
    - Tests are excluded from TypeScript compilation (not in tsconfig)
    - Infrastructure still validates them for proper form
    - Allows documenting incomplete features without breaking CI
    - Question: Should there be a way to track which features are incomplete?

---

## Skipped Tests and Incomplete Features

**Pattern for documenting incomplete features:**

- Use `.test.skip.ts` extension for tests that document unimplemented features
- Tests must still follow proper error test pattern (enforced by infrastructure)
- Tests are excluded from TypeScript compilation via tsconfig
- ESLint errors are expected for skipped tests (not in project config)
- Allows keeping TODO tests in proper form without breaking CI

**Example use cases:**

- Type cast validations not yet implemented (e.g., boolean ↔ integer casts)
- Features that need parser updates
- Tests that document desired behavior for future implementation

**Files:**

- `test/integration/select/select-cast-cannot-cast-boolean-to-integer.error.test.skip.ts`
- `test/integration/select/select-cast-cannot-cast-integer-to-boolean.error.test.skip.ts`
