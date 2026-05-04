# Skipped Integration Tests (8 files)

## 1. [x] CREATE TABLE with DEFAULT values

**File:** `create-table-with-defaults.test.ts`  
**Status:** ✅ Implemented - Parser supports DEFAULT clause with type validation

**Example:**

```sql
age numeric default 18,
active boolean default true,
created_at timestamp default now()
```

Currently the parser skips DEFAULT expressions but doesn't parse them properly.

---

## 2. [x] CREATE TABLE with wrong DEFAULT types

**File:** `create-table-with-wrong-defaults.test.ts`  
**Status:** ✅ Implemented - Type validation for DEFAULT values working

**Example:**

```sql
age numeric default 'xxx'  -- should error: string for numeric column
```

Requires DEFAULT clause parsing first.

---

## 3. [ ] CTE in JOIN
## 3. [x] CTE in JOIN

**File:** `select-cte-in-join.test.ts`  
**Status:** ✅ Implemented - CTE column validation working correctly

**Fixed:** Added CTE scope check in `ParseFromTableAfterLeadingIdent` to validate CTE references before database lookup.

**Example that now works:**

```sql
WITH active_users AS (SELECT id, name FROM users)
SELECT active_users.name, posts.id 
FROM active_users 
LEFT JOIN posts ON active_users.id = posts.user_id;
```

**Implementation:** Created `ParseAliasAfterCTE` to handle CTE references in FROM clause, similar to `ParseAliasAfterTable` for regular tables.

---

## 4. [x] CTE Unknown Column

**File:** `select-cte-unknown-column.test.ts`  
**Status:** ✅ Implemented - CTE column validation working correctly

Now correctly errors when referencing non-existent columns from a CTE.

**Example that now errors:**

```sql
WITH active_users AS (SELECT id, name FROM users)
SELECT invalid_column FROM active_users
```

**Root cause fixed:** `ParseFromTableAfterLeadingIdent` now checks if identifier exists in `Scope` (CTE scope) before trying database lookup.

---

## 5. [x] INSERT...SELECT

**File:** `insert-with-select.test.ts`  
**Status:** ✅ Implemented - Subquery support in INSERT statements with type validation

**Needs:**

```sql
INSERT INTO table (cols) SELECT cols FROM other_table
```

**Requires:**

- Parsing SELECT after column list instead of VALUES
- Type validation between SELECT result and INSERT columns
- Column count matching

---

## 6. [x] UPDATE...FROM

**File:** `update-with-from.test.ts`  
**Status:** ✅ Implemented - FROM clause in UPDATE statements (PostgreSQL extension)

**Needs:**

```sql
UPDATE table SET col = value FROM other_table WHERE condition
```

**Requires:**

- Parsing FROM clause after SET
- Merging FROM scope with UPDATE table scope
- Column resolution across multiple tables in WHERE

---

## 7. [x] DELETE...USING

**File:** `delete-with-using.test.ts`  
**Status:** ✅ Implemented - USING clause in DELETE statements (PostgreSQL extension)

**Needs:**

```sql
DELETE FROM table USING other_table WHERE condition
```

**Requires:**

- Parsing USING clause after table name
- Merging USING scope with DELETE table scope
- Column resolution across multiple tables in WHERE

---

## 8. [x] INSERT NOT NULL validation

**File:** `insert-require-not-null-columns.test.ts`  
**Status:** ✅ Implemented - Validation excludes NOT NULL columns with DEFAULT values

Should error when omitting required NOT NULL columns.

**Example:**

```sql
INSERT INTO users (id) VALUES ('1')  -- should fail if name is NOT NULL
```

Requires tracking which columns have DEFAULT values vs which are truly required.

---

## Summary by Feature Category

### CTEs (Common Table Expressions) - 2 tests

- Parse WITH clause
- Store CTE definitions in scope
- Validate CTE column references
- Make CTEs available in FROM/JOIN

### Subqueries in DML - 3 tests

- INSERT...SELECT: subquery as data source
- UPDATE...FROM: additional tables for updates
- DELETE...USING: additional tables for deletes

### DDL Enhancements - 2 tests

- CREATE TABLE DEFAULT clause parsing
- Type validation for DEFAULT values

### INSERT Validation - 1 test

- NOT NULL constraint checking with DEFAULT awareness

---

## Dependencies

Most of these features are independent except:

- CTE tests are blocked by IS NULL operator support (used in test queries)
- INSERT NOT NULL validation requires DEFAULT clause parsing to know which columns have defaults
- Type validation for DEFAULT values requires DEFAULT clause parsing first
