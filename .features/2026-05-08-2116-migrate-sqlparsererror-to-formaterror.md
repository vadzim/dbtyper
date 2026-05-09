# Migrate SqlParserError to FormatError Status

**Date:** 2026-05-08 21:16  
**Current State:** In Progress

**CRITICAL: Before working on this feature, you MUST read .workflow/ folder:**

1. **FIRST:** Read `.workflow/README.md` - Workflow instructions and guidelines
2. **SECOND:** Read `.workflow/findings.md` - General development patterns and techniques
3. **THIRD:** Read `.workflow/project_knowledge.md` - Project-specific conventions and knowledge
4. **FOURTH:** Read `.workflow/feature_template.md` - Template structure

**This applies whether you are starting, resuming, or reviewing this feature.**

---

## Overview

Migrate all `SqlParserError<...>` usages to `FormatError<...>` with richer, more informative error messages.

**Key changes:**

- Replace `SqlParserError<"message">` with `FormatError<ERROR_ID, [args]>` in source code
- Replace `SqlParserError<"message">` with `DbtyperError<CODE, "formatted message">` in tests
- Make error messages more informative (include table names, column names, schema names, etc.)
- Remove `SqlParserError` type after all migrations complete

**Migration strategy:**

- One-by-one: change one SqlParserError usage, run typecheck, fix broken test, repeat
- Thread context through parsers to provide rich error information
- Use existing error codes from registry or create new ones as needed

---

## Current Understanding

**FormatError structure:**

```typescript
FormatError<ID extends ErrorIds, Args extends Tuple<string | number, Dec[Errors[ID]["msg"]["length"]]>>
```

- First arg: error ID (e.g., "UNKNOWN_TABLE_FROM")
- Second arg: tuple of formatting arguments (length = msg parts - 1)
- Returns: `DbtyperError<Code, FormattedMessage>`

**DbtyperError structure:**

```typescript
DbtyperError<Code extends -1 | keyof ErrorsConst, Message extends string>
```

- Contains error code and formatted message
- Format: `[dbt:CODE] message`

**SqlParserError (to be removed):**

```typescript
SqlParserError<Message extends string> = DbtyperError<-1, Message>
```

- Legacy constructor with code -1
- Parameterless messages

**Example transformation:**

```typescript
// Before (source):
SqlParserError<"Unknown table in FROM">

// After (source):
FormatError<"UNKNOWN_TABLE_FROM", [tableName]>

// Before (test):
SqlParserError<"Unknown table in FROM">

// After (test):
DbtyperError<2200, "[dbt:UNKNOWN_TABLE_FROM] Unknown table users in FROM">
```

---

## Migration Status

### ✅ Completed (Working)

1. **skip-statement.ts** - Updated constraints to accept `DbtyperError` instead of `SqlParserError`
2. **parse-create-schema.ts** - Migrated to FormatError with error codes 3700-3703
3. **parse-drop-schema.ts** - Migrated to FormatError with error codes 3800-3802, 3201
4. **parse-qualified-name.ts** - Migrated to FormatError with error codes 4101-4103
5. **parse-create-type.ts** - Migrated to FormatError, added error codes 1815-1816
6. **parse-sql-type-words.ts** - Migrated to FormatError with error codes for type parsing
7. **parse-qualified-table-name.ts** - Migrated to FormatError with error codes 4107, 4102, 1506
8. **parse-create-table.ts** - Migrated to FormatError (24 usages)
9. **parse-drop-table.ts** - Migrated to FormatError with error codes 1702, 1704, 3204, 3502
10. **parse-drop-type.ts** - Migrated to FormatError, added error code 1817
11. **parse-alter-type.ts** - Migrated to FormatError with error codes 4000, 3207, 3305

**Files migrated:** 11
**SqlParserError usages remaining:** ~603 (down from ~690, 87 migrated, ~13% complete)
**New error codes added:** 1815, 1816, 1817

### 🔄 In Progress

Continuing with medium-sized parser files

### ❌ Incomplete (To Do)

Remaining files with SqlParserError (~15 files):

- parse-create-view.ts
- parse-delete.ts
- parse-insert.ts
- parse-update.ts
- parse-alter-table.ts
- parse-select.ts (large)
- parse-expression.ts (large)
- parse-where-expression.ts
- parser-validate-mutation-value.ts
- resolve-column-ref.ts
- parse-sql-statement.ts
- parser-ref-error-third-sentinel.ts
- lexer/sql-tokens.ts
- core/sql-database.ts
- core/sql-query.ts

---

## What Needs to Be Done

### Priority 1: Setup and Discovery

**Goal:** Set up feature branch and find all SqlParserError usages

**Steps:**

1. Create feature branch `feature/migrate-to-format-error` from dev
2. Search for all `SqlParserError` usages in source code
3. Search for all `SqlParserError` usages in tests
4. Create initial migration plan

**Estimated effort:** 10 minutes

### Priority 2: Migrate Source Code (One-by-One)

**Goal:** Replace each SqlParserError with FormatError in source code

**Approach:**

1. Pick one SqlParserError usage
2. Identify what context is available (table name, column name, etc.)
3. Find or create appropriate error code in registry
4. Replace with FormatError including rich context
5. Run `npm run typecheck:full`
6. Fix broken test (replace SqlParserError with DbtyperError)
7. Verify test passes
8. Commit
9. Repeat

**Estimated effort:** 3-5 hours (depends on number of usages)

### Priority 3: Cleanup

**Goal:** Remove SqlParserError type

**Steps:**

1. Verify no more SqlParserError usages exist
2. Remove SqlParserError type definition
3. Run full test suite
4. Commit

**Estimated effort:** 5 minutes

---

## Technical Challenges

### Challenge 1: Threading Context Through Parsers

**Problem:** Some parsers may not have table/column names readily available

**Solution:**

- Most parsers should already have context
- If not, thread it through function parameters
- Make reasonable decisions based on parser structure

### Challenge 2: Finding Appropriate Error Codes

**Problem:** Need to match SqlParserError messages to error codes in registry

**Solution:**

- Search registry for matching messages
- Use existing codes where possible
- Create new codes if needed (following numbering scheme)

### Challenge 3: Test Message Matching

**Problem:** Tests expect exact error messages

**Solution:**

- Update test to use DbtyperError with code and formatted message
- Include actual values in formatted message (e.g., table name)

---

## Success Criteria

- [ ] All SqlParserError usages in source code replaced with FormatError
- [ ] All SqlParserError usages in tests replaced with DbtyperError
- [ ] Error messages include rich context (table names, column names, etc.)
- [ ] All tests pass: `npm run typecheck:full`
- [ ] SqlParserError type removed from codebase
- [ ] No TypeScript compilation errors

---

## Progress Tracking

**Started:** 2026-05-08 21:16  
**Last Updated:** 2026-05-08 21:16  
**Status:** 🔄 In Progress

**Current Phase:** Setup and Discovery

**Next Steps:**

1. Create feature branch from dev
2. Search for SqlParserError usages
3. Begin one-by-one migration

---

## Notes

- User will be away, so work autonomously
- Make reasonable decisions about context threading
- Focus on making error messages as informative as possible
- Commit frequently after each successful migration
