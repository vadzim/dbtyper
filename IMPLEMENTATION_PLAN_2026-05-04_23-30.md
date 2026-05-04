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

**File:** `select-cte-in-join.test.skip.ts`  
**Missing:** Full CTE (Common Table Expression) implementation

**Needs:**

```sql
WITH cte_name AS (SELECT ...) SELECT ... FROM cte_name JOIN ...
```

**Requires:**

- Parsing WITH clause and CTE definitions
- Storing CTE results in scope
- Making CTEs available as table sources in FROM/JOIN
- Type validation for CTE columns in JOIN ON conditions

**Blocked by:** IS NULL support (the test uses `WHERE id IS NOT NULL`)

---

## 4. [ ] CTE Unknown Column

**File:** `select-cte-unknown-column.test.skip.ts`  
**Missing:** CTE column validation

Should error when referencing non-existent columns from a CTE.

**Example:**

```sql
WITH active_users AS (SELECT id, name FROM users)
SELECT invalid_column FROM active_users
```

Requires same CTE infrastructure as #3.

---

## 5. [ ] INSERT...SELECT

**File:** `insert-with-select.test.skip.ts`  
**Missing:** Subquery support in INSERT statements

**Needs:**

```sql
INSERT INTO table (cols) SELECT cols FROM other_table
```

**Requires:**

- Parsing SELECT after column list instead of VALUES
- Type validation between SELECT result and INSERT columns
- Column count matching

---

## 6. [ ] UPDATE...FROM

**File:** `update-with-from.test.skip.ts`  
**Missing:** FROM clause in UPDATE statements (PostgreSQL extension)

**Needs:**

```sql
UPDATE table SET col = value FROM other_table WHERE condition
```

**Requires:**

- Parsing FROM clause after SET
- Merging FROM scope with UPDATE table scope
- Column resolution across multiple tables in WHERE

---

## 7. [ ] DELETE...USING

**File:** `delete-with-using.test.skip.ts`  
**Missing:** USING clause in DELETE statements (PostgreSQL extension)

**Needs:**

```sql
DELETE FROM table USING other_table WHERE condition
```

**Requires:**

- Parsing USING clause after table name
- Merging USING scope with DELETE table scope
- Column resolution across multiple tables in WHERE

---

## 8. [ ] INSERT NOT NULL validation

**File:** `insert-require-not-null-columns.test.skip.ts`  
**Missing:** Validation that NOT NULL columns without defaults are provided in INSERT

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
