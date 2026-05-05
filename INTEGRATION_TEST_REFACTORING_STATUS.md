# Integration Test Refactoring Status

**Date:** 2026-05-05  
**Branch:** integration-tests  
**Commit:** ffb948d

## ✅ Completed

### 1. Fixed TypeScript Compilation Errors

Fixed 3 `[monad.multipleConsumption]` errors in:
- `src/parser/parse-qualified-name.ts`
- `src/parser/parse-alter-type.ts`
- `src/parser/parse-drop-type.ts`

**Root cause:** TypeScript's monad consumption checker prevents using a monad (like `AfterFirst`) after it has been consumed by `SkipToken<AfterFirst>`.

**Solution:** Changed evaluation order:
1. First check `PeekToken<AfterFirst>` for specific tokens (non-consuming)
2. Only call `SkipToken<AfterFirst>` when actually needed

**Example fix:**
```typescript
// ❌ BEFORE (causes error)
type ParseAfterFirstIdent<AfterFirst extends TokensList, ...> =
    PeekToken<AfterFirst> extends infer T1
        ? SkipToken<AfterFirst> extends infer R1 extends TokensList
            ? T1 extends TokenKey<".">
                ? ParseQualifiedSecondIdent<R1, A>
                : T1 extends TokenKey<"as"> | TokenKey<"add"> | TokenKey<";"> | TokenEot
                    ? [AfterFirst, null, Db["defaultSchema"], A]  // ❌ AfterFirst already consumed
                    : [R1, SqlParserError<...>, never, never]
            : never
        : never

// ✅ AFTER (works)
type ParseAfterFirstIdent<AfterFirst extends TokensList, ...> =
    PeekToken<AfterFirst> extends TokenKey<"as"> | TokenKey<"add"> | TokenKey<";"> | TokenEot
        ? [AfterFirst, null, Db["defaultSchema"], A]  // ✅ Not consumed yet
        : PeekToken<AfterFirst> extends infer T1
            ? SkipToken<AfterFirst> extends infer R1 extends TokensList
                ? T1 extends TokenKey<".">
                    ? ParseQualifiedSecondIdent<R1, A>
                    : [R1, SqlParserError<...>, never, never]
                : never
            : never
```

### 2. Renamed 110 Integration Test Files

Renamed all files from `.test.ts` to `.success.test.ts` or `.error.test.ts` based on presence of `@ts-expect-error` comments.

**Classification logic:**
- Files with `@ts-expect-error` → `.error.test.ts`
- Files without `@ts-expect-error` → `.success.test.ts`

**Results:**
- 69 files → `.success.test.ts`
- 41 files → `.error.test.ts`

## ❌ Remaining Issues

### Test Validation Rules

The integration test infrastructure (`test/infra/integration-file-naming.test.ts`) enforces strict rules:

1. **File naming:** Must end with `.success.test.ts`, `.error.test.ts`, `.success.test.skip.ts`, or `.error.test.skip.ts`
2. **Single query per file:** Each file must call `.query()` or `.stream()` **at most once**
3. **Success files must not contain:**
   - `@ts-expect-error` comments
   - `❌` (error marker emoji)
   - The word "error" in certain contexts
4. **Error files must contain:**
   - Exactly one `@ts-expect-error` comment
   - `@ts-expect-error` must be immediately before a backtick
5. **Error files must not contain:**
   - `✅` (success marker emoji)
   - The word "success"

### Current Problems

**89 test validation failures** due to:

#### 1. Multiple `.query()` calls per file (28 files)

Files with multiple test cases need to be split:

| File | Calls | Type |
|------|-------|------|
| `select/select-window-functions.success.test.ts` | 14 | query |
| `select/select-with-enums.success.test.ts` | 11 | query |
| `select/select-case-searched.success.test.ts` | 11 | query |
| `expressions/enum-error-cases.success.test.ts` | 11 | query |
| `select/select-any-all-some.success.test.ts` | 10 | query |
| `expressions/enum-casting-complex.success.test.ts` | 10 | query |
| `select/select-case-simple.success.test.ts` | 9 | query |
| `select/select-array-functions.success.test.ts` | 8 | query |
| `select/select-array-operators.success.test.ts` | 8 | query |
| `insert/insert-with-enums.success.test.ts` | 7 | query |
| `select/select-type-casts.success.test.ts` | 7 | query |
| `ddl/create-table-array-types.success.test.ts` | 7 | query |
| `ddl/create-table-postgresql-types.success.test.ts` | 7 | query |
| `update/update-with-enums.success.test.ts` | 6 | query |
| `query-stream/query-accepts-non-returning.success.test.ts` | 6 | query |
| `query-stream/stream-rejects-non-returning.success.test.ts` | 6 | stream |
| `expressions/enum-multi-schema.success.test.ts` | 6 | query |
| ... and 11 more files with 2-5 calls each |

#### 2. Mixed success/error markers in files

Some files contain both success and error test cases:

**`.success.test.ts` files with `@ts-expect-error`:**
- `select/smoke-basic-select.success.test.ts`
- `select/select-type-casts.success.test.ts`
- `update/update-with-enums.success.test.ts`
- `select/select-with-enums.success.test.ts`
- And others...

**`.error.test.ts` files with success markers:**
- `delete/smoke-delete.error.test.ts`
- `insert/smoke-insert.error.test.ts`
- `update/smoke-update.error.test.ts`

#### 3. Files with multiple `sqlMigrations()` calls

Some files set up multiple database schemas, which violates the "exactly one `sqlMigrations()` call" rule.

## 📋 Required Work

### Phase 1: Split Files with Multiple Queries (Highest Priority)

**Estimated time:** 8-12 hours

Split 28 files into individual test files. Each new file should:
- Have exactly one `.query()` or `.stream()` call
- Be named descriptively (e.g., `select-window-row-number.success.test.ts`)
- Contain only success OR error cases, not both

**Example split:**

`select-window-functions.success.test.ts` (14 queries) →
- `select-window-row-number.success.test.ts`
- `select-window-rank.success.test.ts`
- `select-window-dense-rank.success.test.ts`
- `select-window-lag.success.test.ts`
- `select-window-lead.success.test.ts`
- `select-window-first-value.success.test.ts`
- `select-window-last-value.success.test.ts`
- `select-window-partition-by.success.test.ts`
- `select-window-order-by.success.test.ts`
- `select-window-frame-rows.success.test.ts`
- `select-window-frame-range.success.test.ts`
- `select-window-multiple-functions.success.test.ts`
- `select-window-unknown-function.error.test.ts`
- `select-window-invalid-partition.error.test.ts`

### Phase 2: Separate Mixed Success/Error Files

**Estimated time:** 4-6 hours

Files with both `✅` and `❌` markers need to be split into separate `.success.test.ts` and `.error.test.ts` files.

**Example:**

`smoke-basic-select.success.test.ts` (currently has 2 success + 1 error) →
- `smoke-basic-select-named-columns.success.test.ts`
- `smoke-basic-select-star.success.test.ts`
- `smoke-basic-select-invalid-column.error.test.ts`

### Phase 3: Fix Remaining Validation Issues

**Estimated time:** 2-4 hours

- Ensure all `.error.test.ts` files have exactly one `@ts-expect-error`
- Remove success markers from error files
- Remove error markers from success files
- Fix `@ts-expect-error` placement (must be immediately before backtick)

## 🎯 Total Estimated Time

**14-22 hours** of manual refactoring work

## 📝 Notes

- The test infrastructure is very strict by design to ensure test quality
- Each test file should be a minimal, focused example
- This refactoring will result in ~200-300 test files (up from 110)
- The benefit: clearer test organization, easier debugging, better documentation

## 🔄 Next Steps

1. Start with Phase 1 (split high-count files first)
2. Use a systematic approach: pick one file, split it completely, verify tests pass
3. Commit after each file or small batch
4. Track progress in this document

## 📊 Progress Tracking

- [ ] Phase 1: Split files with multiple queries (0/28 files)
- [ ] Phase 2: Separate mixed success/error files (0/~15 files)
- [ ] Phase 3: Fix validation issues (0/~20 files)
- [ ] All integration tests passing
