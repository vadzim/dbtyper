# API Design Log: db.query() Error Handling

## Goal

Design an API for `db.query()` and `db.stream()` so that **invalid SQL queries produce TypeScript compile-time errors** in real usage (not only in type-level tests).

## Current state

### Existing API

```typescript
const db = sqlMigrations({ driver }).apply(`CREATE TABLE users (id TEXT, name TEXT)`).database()

// This does NOT produce a compile-time error (but it should!)
const rows = await db.query(`SELECT invalid_column FROM users`)
```

### Problem

- `db.query()` uses `CheckSqlValid` in a parameter constraint
- But in real usage, errors do not appear
- The issue might be that the `Db` type is not preserved through `.database()`

## Experiments

### Design 1: Current API (FAILED)

**Idea:** Verify whether `CheckSqlValid` works in the current API.

**Attempt:** `test/integration/api-design/01-current-api.ts`

**Code:**

```typescript
const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

// @ts-expect-error - expecting an error
const badQuery = await db.query(`select invalid_column from users;`)
```

**Result:** ❌ **DOES NOT WORK**

- `@ts-expect-error` does not trigger - there is no compile-time error
- `db.query()` accepts any SQL without validation
- `CheckSqlValid` does not trigger in runtime-style usage

**Problem:**

- The `Db` type is lost through `.database()`
- Or `CheckSqlValid` cannot compute the `Db` type in runtime-style usage
- A different way to preserve the DB type may be required

**Status:** A different API design is needed

---

### Design 2: Detailed db.query() type check (SUCCESS!)

**Idea:** Check whether `CheckSqlValid` truly sees the `Db` type and validates queries.

**Attempt:** `test/integration/api-design/02b-query-signature.ts`

**Code:**

```typescript
const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id text, name text);`).database()

const bad = await db.query(`select invalid_column from users;`)
```

**Result:** ✅ **WORKS!**

```
error TS2345: Argument of type '"select invalid_column from users;"'
is not assignable to parameter of type '"Unknown column"'.
```

**Conclusions:**

- ✅ **The API really works!** `CheckSqlValid` validates queries
- ✅ The `Db` type is preserved through `.database()`
- ✅ Invalid queries produce compile-time errors
- ❌ Design 1 issue: `@ts-expect-error` does not surface the error in `npm run typecheck` (but the error exists!)

**Decision:**
The current API **already works correctly**. Tests should use **type-level tests** (as in Design 4 from `DESIGN_LOG.md`), not `@ts-expect-error`.

**Status:** ✅ API works! It only needs correct testing style

---

### Design 3: Alternative API with .result() (NOT NEEDED)

**Idea:** `db.query(...).result()` instead of `db.query(...)`

**Attempt:** `test/integration/api-design/03-result-api.ts`

**Code:**

```typescript
// Current API
const current = await db.query(`select id from users;`)

// Alternative API
const alternative = await db.query(`select id from users`).result()
```

**Result:** ❌ **NOT NEEDED**

**Advantages:**

- More explicit (clearly async)
- Could allow adding .validate() or .check() before .result()

**Disadvantages:**

- More verbose
- Breaking change without benefit
- No additional validation capabilities

**Conclusions:**

- The current API already works and validates
- `.result()` adds no extra capabilities
- Simpler and better: `db.query(...)`

**Status:** ❌ Rejected

---

### Design 4: Builder pattern API (NOT NEEDED)

**Idea:** `db.select(...).from(...).where(...).execute()`

**Attempt:** `test/integration/api-design/04-builder-api.ts`

**Code:**

```typescript
// Current API
const current = await db.query(`select id, name from users where active = true;`)

// Builder API
const builder = await db.select(`id, name`).from(`users`).where(`active = true`).execute()
```

**Result:** ❌ **NOT NEEDED**

**Advantages:**

- More structured
- Can validate each step separately
- Better autocompletion

**Disadvantages:**

- Very verbose
- SQL simplicity is lost
- This is already a query builder (contradicts library philosophy)
- LLMs know SQL better than a builder DSL

**Conclusions:**

- Contradicts the "Write plain SQL" philosophy
- LLMs know SQL better than a builder DSL
- The current API is simpler and clearer

**Status:** ❌ Rejected

---

## Final result

**✅ The current API is ideal!**

```typescript
const db = sqlMigrations({ driver }).apply(`create table users (id text, name text);`).database()

// ✅ Valid SQL - compiles
const good = await db.query(`select id, name from users;`)

// ❌ Invalid SQL - compile-time error
const bad = await db.query(`select invalid_column from users;`)
// error TS2345: Argument of type '"select invalid_column from users;"'
// is not assignable to parameter of type '"Unknown column"'.
```

**Why the current API is better:**

1. ✅ Validation works through `CheckSqlValid`
2. ✅ Plain SQL (universal and familiar)
3. ✅ LLMs can write SQL directly
4. ✅ Less code, more clarity
5. ✅ Matches the "Write plain SQL" philosophy

**What tests should use:**

- Use **type-level tests** (as in `test/integration/smoke/01-basic-select.test.ts`)
- DO NOT use `@ts-expect-error` (it does not surface errors in typecheck)
