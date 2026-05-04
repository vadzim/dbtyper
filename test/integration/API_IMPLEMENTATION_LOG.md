# API Implementation Design Log

## Goal

Create 4 API implementation variants in `src/core/sql-database.ts` and verify which one is best for error validation.

## Current state

File: `src/core/sql-database.ts`

Key types:

- `SqlMigrations<Db>` - migration interface
- `DataBase<Db>` - database interface with `query()` and `stream()`
- `CheckSqlValid<Db, Stmt>` - type-level SQL validation

Current implementation:

```typescript
export interface SqlMigrations<Db> {
  apply(statement): SqlMigrations<NewDb>
  database(): DataBase<Db>
}

export type DataBase<Db> = {
  query<Stmt>(statement: Stmt extends CheckSqlValid<Db, Stmt> ? Stmt : CheckSqlValid<Db, Stmt>): Promise<Array<...>>
}
```

## Plan

Create 4 implementation variants:

### Variant 1: Current API (baseline)

Keep as-is for comparison.

### Variant 2: Explicit validation method

Add a `.validate()` method to validate SQL before execution.

### Variant 3: Separate typed/untyped interfaces

Split `DataBase` into `TypedDataBase` and `UntypedDataBase`.

### Variant 4: Builder-style with validation

Query builder with validation at each step.

## Experiments

### Variant 1: Current API (BASELINE) ✅

**File:** `test/integration/api-variants/variant1-baseline.ts`

**Structure:**

```typescript
const db = sqlMigrations({ driver }).apply(`create table users (id text, name text);`).database()

const rows = await db.query(`select id, name from users;`)
```

**Advantages:**

- ✅ Simple and intuitive
- ✅ Validation works through `CheckSqlValid`
- ✅ Matches the "Write plain SQL" philosophy
- ✅ LLMs can write SQL directly

**Disadvantages:**

- ⚠️ Error messages could be clearer
- ⚠️ No way to validate SQL without execution (but `InferSqlErrors` exists)

**Status:** ✅ Works perfectly

---

### Variant 2: Explicit Validation Method ❌

**File:** `test/integration/api-variants/variant2-explicit-validation.ts`

**Idea:** Add `.validateQuery()` to validate SQL without execution

**Proposed changes:**

```typescript
export type DataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>
  validateQuery<Stmt>(statement: Stmt): InferSqlErrors<Db, Stmt>  // NEW
}
```

**Conclusions:**

- ❌ **NOT NEEDED**
- `InferSqlErrors<Db, Stmt>` already exists as a type-level helper
- Runtime method is unnecessary (there is no runtime validation)
- Additional API surface without benefit

**Status:** ❌ Rejected

---

### Variant 3: Separate Typed/Untyped Interfaces ❌

**File:** `test/integration/api-variants/variant3-separate-interfaces.ts`

**Idea:** Split `DataBase` into `TypedDataBase` and `UntypedDataBase`

**Proposed changes:**

```typescript
export type TypedDataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>
  stream<Stmt>(...): AsyncIterable<...>
}

export type UntypedDataBase = {
  queryUntyped(...): Promise<Array<any>>
  streamUntyped(...): AsyncIterable<any>
}

export type DataBase<Db> = TypedDataBase<Db> & UntypedDataBase & {...}
```

**Conclusions:**

- ❌ **NOT NEEDED**
- The split provides no practical benefit
- It complicates structure without additional safety
- `queryUntyped()` is an escape hatch, not the main API

**Status:** ❌ Rejected

---

### Variant 4: Query Builder with Validation ❌

**File:** `test/integration/api-variants/variant4-query-builder.ts`

**Idea:** `db.select().from().where().execute()` with validation at each step

**Proposed changes:**

```typescript
export type DataBase<Db> = {
  query<Stmt>(...): Promise<Array<...>>

  // NEW builder API
  select<Cols>(columns: Cols): SelectBuilder<Db, Cols>
}

type SelectBuilder<Db, Cols> = {
  from<Table>(table: Table): FromBuilder<Db, Cols, Table>
}

type FromBuilder<Db, Cols, Table> = {
  where<Cond>(condition: Cond): WhereBuilder<...>
  execute(): Promise<Array<...>>
}
```

**Comparison:**

```typescript
// Current API (1 line)
await db.query(`select id, name from users where active = true`)

// Builder API (5 lines)
await db.select(`id, name`).from(`users`).where(`active = true`).execute()
```

**Conclusions:**

- ❌ **NOT NEEDED**
- Contradicts the "Write plain SQL" philosophy
- Very verbose
- LLMs understand SQL better than a builder DSL
- Not all SQL features can be expressed via a builder

**Status:** ❌ Rejected

---

## Final result

**✅ VARIANT 1 (current API) is ideal!**

There is no need to change `src/core/sql-database.ts`.

**Why the current API is better than all alternatives:**

1. **Simplicity** - `db.query(sql)` is intuitive
2. **Validation works** - `CheckSqlValid` catches errors
3. **Plain SQL** - matches the library philosophy
4. **LLM-friendly** - models know SQL, not builder DSL
5. **Compact** - less code, more clarity
6. **Complete** - supports full SQL, not only a builder subset

**What already exists:**

- ✅ `db.query()` - typed queries
- ✅ `db.queryUntyped()` - escape hatch
- ✅ `InferSqlErrors<Db, Stmt>` - type-level checks
- ✅ `CheckSqlValid` - validation in the parameter constraint

**Recommendation:** Keep the current API unchanged.
