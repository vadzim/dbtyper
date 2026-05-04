# Design Log: Integration Tests Error Handling

## Goal

Find a testing approach so that **invalid SQL queries produce TypeScript compile-time errors**.

## Problem

- `@ts-expect-error` does not work in runtime tests
- `db.query()` uses `CheckSqlValid`, but errors do not appear
- Existing tests use type-level tests (`Expect<Extends<...>>`), not runtime tests

## Experiments

### Design 1: Runtime tests with @ts-expect-error (FAILED)

**Idea:** Use `await db.query(...)` with `@ts-expect-error` for invalid queries.

**Attempt:** `test/integration/smoke/01-basic-select.test.ts`

**Result:** ❌ Does not work

- `@ts-expect-error` shows "Unused directive" - no error is produced
- `mockDriver` with empty `scalarTypes: {}` does not provide correct validation
- A proper `PostgresTypeMap` is required

**Status:** Reverted, trying another approach

---

### Design 2: Type-level tests like in parse-select.test.ts (FAILED)

**Idea:** Use `ParseSqlStatement` + `Expect<Extends<Tuple3At2<...>>>` as in existing tests.

**Attempt:** `test/integration/smoke/02-design2-type-level.test.ts`

**Result:** ❌ Does not work

- All `Expect<Extends<...>>` checks fail with `Type 'false' does not satisfy the constraint 'true'`
- The issue may be in `ApplyStatements` or in `TestDb` structure
- It requires deeper investigation to understand why types do not match

**Status:** Reverted, trying another approach

---

### Design 3: InferSqlErrors API (PARTIAL SUCCESS)

**Idea:** Use `InferSqlErrors<Db, Stmt>` - public API for checking errors.

**Attempt:** `test/integration/smoke/03-design3-infer-errors.test.ts`

**Result:** ⚠️ Partial success

- ✅ Success-case tests (valid queries) **work** - `InferSqlErrors` returns `null`
- ❌ Error-case tests **do not work** - `InferSqlErrors` does not return `SqlParserError` for invalid queries
- Column/table validation may not be implemented in the parser

**Conclusions:**

- `InferSqlErrors` API exists and works for success scenarios
- But error validation (invalid columns/tables) may not be implemented
- Need to verify whether parser actually validates column/table existence

**Status:** Need deeper investigation into whether validation is implemented at all

---

### Design 4: Copy exactly from parse-select.test.ts (SUCCESS!)

**Idea:** Use **exactly** the same DB structure and test style as in `parse-select.test.ts`.

**Attempt:** `test/integration/smoke/04-design4-exact-copy.test.ts`

**Result:** ✅ **SUCCESS!**

- ✅ Success-case test (valid SELECT) - **works**
- ✅ Error-case test (invalid column) - **works**! `SqlParserError` is returned
- ❌ Error-case test (invalid table) - **does not work** (table validation may not be implemented)

**Conclusions:**

- ✅ **Column validation works!** The parser checks column existence in a table
- ❌ Table validation may not work (or may require a different approach)
- ✅ **Working approach found:** `ParseSqlStatement` + `Tuple3At2` + `Expect<Extends<..., SqlParserError<string>>>`

**Decision:**
Use this style for all integration tests:

```typescript
type TestDb = ApplyStatements<SqlDatabase, `create schema public; create table users (...);`>[0]
type TBadQuery = ParseSqlStatement<ParseSqlTokens<`select wrong_col from users;`>, TestDb>
type _test = Expect<Extends<Tuple3At2<TBadQuery>, SqlParserError<string>>>
```

**Status:** ✅ Done! We have a working design

---

## Summary

**Working design:** Design 4

**What works:**

- ✅ Type-level tests via `ParseSqlStatement` + `Tuple3At2`
- ✅ Column validation (invalid column -> `SqlParserError`)
- ✅ Success-case tests (valid SQL -> `JsqlSelectStatementResult`)

**What does not work:**

- ❌ Table validation (possibly not implemented or requires a different approach)

**Next steps:**

1. Use Design 4 for smoke tests
2. Investigate why table validation does not work
3. Cover all functionality with tests in this style
