# Integration Test Coverage

This document lists all integration tests that need to be implemented to ensure comprehensive coverage of the dbtyper library.

## Test Status Legend

- ✅ **Implemented** — test exists and passes
- 🚧 **In Progress** — test partially implemented
- ⏳ **Planned** — test planned but not yet implemented
- 🔴 **Blocked** — test blocked by missing feature or bug

## Priority Levels

- **P0** — Critical: core functionality, must work
- **P1** — High: common use cases
- **P2** — Medium: edge cases, less common scenarios
- **P3** — Low: rare edge cases, nice-to-have

---

## 1. SELECT Queries

### 1.1 Basic SELECT (P0)

| Status | Test                              | File                      | Description                                  |
| ------ | --------------------------------- | ------------------------- | -------------------------------------------- |
| ✅     | SELECT named columns              | `01-basic-select.test.ts` | `SELECT id, name FROM users`                 |
| ✅     | SELECT with WHERE                 | `01-basic-select.test.ts` | `SELECT * FROM users WHERE id = '1'`         |
| ✅     | SELECT unknown column (error)     | `01-basic-select.test.ts` | `SELECT invalid_col FROM users` should fail  |
| ⏳     | SELECT \* expansion               | -                         | `SELECT * FROM users` expands to all columns |
| ⏳     | SELECT with column aliases        | -                         | `SELECT id AS user_id FROM users`            |
| ⏳     | SELECT from qualified table       | -                         | `SELECT id FROM public.users`                |
| ⏳     | SELECT from unknown table (error) | -                         | `SELECT * FROM nonexistent` should fail      |

### 1.2 WHERE Clause (P1)

| Status | Test                        | File                      | Description                                |
| ------ | --------------------------- | ------------------------- | ------------------------------------------ |
| ✅     | WHERE with = operator       | `01-basic-select.test.ts` | `WHERE id = '1'`                           |
| ⏳     | WHERE with !=, <, >, <=, >= | -                         | All comparison operators                   |
| ⏳     | WHERE with AND / OR / NOT   | -                         | Boolean logic                              |
| ⏳     | WHERE with IN (list)        | -                         | `WHERE id IN ('1', '2')`                   |
| ⏳     | WHERE with BETWEEN          | -                         | `WHERE age BETWEEN 18 AND 65`              |
| ⏳     | WHERE with IS NULL          | -                         | `WHERE email IS NULL`                      |
| ⏳     | WHERE with IS NOT NULL      | -                         | `WHERE email IS NOT NULL`                  |
| ⏳     | WHERE type mismatch (error) | -                         | `WHERE id = 123` (text vs int) should fail |

### 1.3 JOINs (P0)

| Status | Test                                | File               | Description                                    |
| ------ | ----------------------------------- | ------------------ | ---------------------------------------------- |
| ✅     | INNER JOIN                          | `05-joins.test.ts` | `INNER JOIN posts ON users.id = posts.user_id` |
| ✅     | LEFT JOIN with nullability          | `05-joins.test.ts` | Result columns from right table are nullable   |
| ✅     | JOIN with ambiguous column (error)  | `05-joins.test.ts` | `SELECT id FROM users JOIN posts` should fail  |
| ⏳     | RIGHT JOIN                          | -                  | `RIGHT JOIN` with nullability                  |
| ⏳     | FULL OUTER JOIN                     | -                  | `FULL OUTER JOIN` with nullability             |
| ⏳     | CROSS JOIN                          | -                  | Cartesian product                              |
| ⏳     | Multiple JOINs                      | -                  | 3+ tables joined                               |
| ⏳     | Cross-schema JOIN                   | -                  | `JOIN other_schema.table`                      |
| ⏳     | Self-join                           | -                  | `users u1 JOIN users u2`                       |
| ⏳     | JOIN with invalid condition (error) | -                  | Type mismatch in ON clause                     |

### 1.4 Subqueries (P1)

| Status | Test                           | File | Description                                      |
| ------ | ------------------------------ | ---- | ------------------------------------------------ |
| ⏳     | Scalar subquery in SELECT      | -    | `SELECT (SELECT COUNT(*) FROM posts) AS count`   |
| ⏳     | Subquery in WHERE with IN      | -    | `WHERE id IN (SELECT user_id FROM posts)`        |
| ⏳     | Subquery with EXISTS           | -    | `WHERE EXISTS (SELECT 1 FROM posts WHERE ...)`   |
| ⏳     | Correlated subquery            | -    | Subquery references outer query                  |
| ⏳     | Subquery type mismatch (error) | -    | `WHERE id IN (SELECT name FROM ...)` should fail |

### 1.5 CTEs (Common Table Expressions) (P2)

| Status | Test                       | File | Description                                      |
| ------ | -------------------------- | ---- | ------------------------------------------------ |
| ⏳     | Simple CTE                 | -    | `WITH cte AS (SELECT ...) SELECT * FROM cte`     |
| ⏳     | Multiple CTEs              | -    | `WITH cte1 AS (...), cte2 AS (...)`              |
| ⏳     | CTE used in JOIN           | -    | `WITH cte AS (...) SELECT * FROM users JOIN cte` |
| ⏳     | Recursive CTE              | -    | `WITH RECURSIVE ...`                             |
| ⏳     | CTE unknown column (error) | -    | Reference non-existent column from CTE           |

### 1.6 Aggregation & GROUP BY (P1)

| Status | Test                                            | File | Description                                            |
| ------ | ----------------------------------------------- | ---- | ------------------------------------------------------ |
| ⏳     | GROUP BY single column                          | -    | `SELECT user_id, COUNT(*) FROM posts GROUP BY user_id` |
| ⏳     | GROUP BY multiple columns                       | -    | `GROUP BY col1, col2`                                  |
| ⏳     | HAVING clause                                   | -    | `HAVING COUNT(*) > 5`                                  |
| ⏳     | Aggregate functions (COUNT, SUM, AVG, MIN, MAX) | -    | All standard aggregates                                |
| ⏳     | Invalid GROUP BY (error)                        | -    | SELECT non-grouped column without aggregate            |

### 1.7 Functions (P1)

| Status | Test                                    | File | Description                            |
| ------ | --------------------------------------- | ---- | -------------------------------------- |
| ⏳     | Built-in string functions               | -    | `LOWER()`, `UPPER()`, `CONCAT()`, etc. |
| ⏳     | Built-in numeric functions              | -    | `ABS()`, `ROUND()`, `FLOOR()`, etc.    |
| ⏳     | Built-in date functions                 | -    | `NOW()`, `DATE_TRUNC()`, etc.          |
| ⏳     | Custom functions via Db.functions       | -    | User-defined function registry         |
| ⏳     | Unknown function (error)                | -    | Call non-existent function should fail |
| ⏳     | Function argument type mismatch (error) | -    | Wrong argument type should fail        |

### 1.8 ORDER BY & LIMIT (P2)

| Status | Test                            | File | Description              |
| ------ | ------------------------------- | ---- | ------------------------ |
| ⏳     | ORDER BY single column          | -    | `ORDER BY name`          |
| ⏳     | ORDER BY multiple columns       | -    | `ORDER BY name, id DESC` |
| ⏳     | ORDER BY with ASC/DESC          | -    | Explicit sort direction  |
| ⏳     | LIMIT clause                    | -    | `LIMIT 10`               |
| ⏳     | OFFSET clause                   | -    | `OFFSET 20`              |
| ⏳     | LIMIT + OFFSET                  | -    | Pagination               |
| ⏳     | ORDER BY unknown column (error) | -    | Should fail              |

---

## 2. INSERT Queries

### 2.1 Basic INSERT (P0)

| Status | Test                                   | File                | Description                                          |
| ------ | -------------------------------------- | ------------------- | ---------------------------------------------------- |
| ✅     | INSERT single row                      | `02-insert.test.ts` | `INSERT INTO users (id, name) VALUES ('1', 'Alice')` |
| ✅     | INSERT with RETURNING                  | `02-insert.test.ts` | `INSERT ... RETURNING *`                             |
| ✅     | INSERT type mismatch (error)           | `02-insert.test.ts` | Wrong value type should fail                         |
| ⏳     | INSERT multiple rows                   | -                   | `VALUES (...), (...), (...)`                         |
| ⏳     | INSERT with DEFAULT                    | -                   | `INSERT INTO users (id) VALUES (DEFAULT)`            |
| ⏳     | INSERT missing required column (error) | -                   | Omit NOT NULL column should fail                     |
| ⏳     | INSERT unknown column (error)          | -                   | Insert into non-existent column should fail          |
| ⏳     | INSERT into unknown table (error)      | -                   | Should fail                                          |

### 2.2 INSERT with SELECT (P2)

| Status | Test                                    | File | Description                             |
| ------ | --------------------------------------- | ---- | --------------------------------------- |
| ⏳     | INSERT ... SELECT                       | -    | `INSERT INTO table SELECT * FROM other` |
| ⏳     | INSERT ... SELECT type mismatch (error) | -    | Column types don't match                |

---

## 3. UPDATE Queries

### 3.1 Basic UPDATE (P0)

| Status | Test                          | File                | Description                                    |
| ------ | ----------------------------- | ------------------- | ---------------------------------------------- |
| ✅     | UPDATE with WHERE             | `03-update.test.ts` | `UPDATE users SET name = 'Bob' WHERE id = '1'` |
| ✅     | UPDATE with RETURNING         | `03-update.test.ts` | `UPDATE ... RETURNING *`                       |
| ✅     | UPDATE type mismatch (error)  | `03-update.test.ts` | Wrong value type should fail                   |
| ⏳     | UPDATE multiple columns       | -                   | `SET col1 = ..., col2 = ...`                   |
| ⏳     | UPDATE without WHERE          | -                   | Update all rows                                |
| ⏳     | UPDATE unknown column (error) | -                   | Set non-existent column should fail            |
| ⏳     | UPDATE unknown table (error)  | -                   | Should fail                                    |

### 3.2 UPDATE with JOIN (P2)

| Status | Test                                   | File | Description                                 |
| ------ | -------------------------------------- | ---- | ------------------------------------------- |
| ⏳     | UPDATE with FROM clause                | -    | `UPDATE users SET ... FROM posts WHERE ...` |
| ⏳     | UPDATE with JOIN type mismatch (error) | -    | Should fail                                 |

---

## 4. DELETE Queries

### 4.1 Basic DELETE (P0)

| Status | Test                              | File                | Description                        |
| ------ | --------------------------------- | ------------------- | ---------------------------------- |
| ✅     | DELETE with WHERE                 | `04-delete.test.ts` | `DELETE FROM users WHERE id = '1'` |
| ✅     | DELETE with RETURNING             | `04-delete.test.ts` | `DELETE ... RETURNING *`           |
| ⏳     | DELETE without WHERE              | -                   | Delete all rows                    |
| ⏳     | DELETE from unknown table (error) | -                   | Should fail                        |
| ⏳     | DELETE with invalid WHERE (error) | -                   | Type mismatch in condition         |

### 4.2 DELETE with JOIN (P2)

| Status | Test                     | File | Description                               |
| ------ | ------------------------ | ---- | ----------------------------------------- |
| ⏳     | DELETE with USING clause | -    | `DELETE FROM users USING posts WHERE ...` |

---

## 5. Schema Operations

### 5.1 CREATE TABLE (P1)

| Status | Test                           | File | Description                      |
| ------ | ------------------------------ | ---- | -------------------------------- |
| ⏳     | CREATE TABLE basic             | -    | Verify schema is updated         |
| ⏳     | CREATE TABLE with constraints  | -    | NOT NULL, UNIQUE, PRIMARY KEY    |
| ⏳     | CREATE TABLE with foreign key  | -    | REFERENCES                       |
| ⏳     | CREATE TABLE IF NOT EXISTS     | -    | Idempotent creation              |
| ⏳     | CREATE TABLE duplicate (error) | -    | Table already exists should fail |

### 5.2 ALTER TABLE (P2)

| Status | Test                              | File | Description                |
| ------ | --------------------------------- | ---- | -------------------------- |
| ⏳     | ALTER TABLE ADD COLUMN            | -    | Schema updated correctly   |
| ⏳     | ALTER TABLE DROP COLUMN           | -    | Column removed from schema |
| ⏳     | ALTER TABLE RENAME COLUMN         | -    | Column renamed in schema   |
| ⏳     | ALTER TABLE unknown table (error) | -    | Should fail                |

### 5.3 DROP TABLE (P2)

| Status | Test                             | File | Description                    |
| ------ | -------------------------------- | ---- | ------------------------------ |
| ⏳     | DROP TABLE                       | -    | Table removed from schema      |
| ⏳     | DROP TABLE IF EXISTS             | -    | Idempotent deletion            |
| ⏳     | DROP TABLE unknown table (error) | -    | Should fail (unless IF EXISTS) |

---

## 6. PostgreSQL-Specific Features

### 6.1 Arrays (P1)

| Status | Test                           | File | Description                    |
| ------ | ------------------------------ | ---- | ------------------------------ |
| ⏳     | ARRAY constructor              | -    | `ARRAY[1, 2, 3]`               |
| ⏳     | Array indexing                 | -    | `arr[1]`                       |
| ⏳     | Array operators (@>, &&, etc.) | -    | Containment and overlap        |
| ⏳     | Array type mismatch (error)    | -    | Wrong element type should fail |

### 6.2 JSON/JSONB (P2)

| Status | Test                            | File | Description                 |
| ------ | ------------------------------- | ---- | --------------------------- |
| ⏳     | JSON column type                | -    | Store and query JSON        |
| ⏳     | JSONB operators (->, ->>, etc.) | -    | JSON path access            |
| ⏳     | JSON functions                  | -    | `json_build_object()`, etc. |

### 6.3 ENUM Types (P2)

| Status | Test                          | File | Description                    |
| ------ | ----------------------------- | ---- | ------------------------------ |
| ⏳     | CREATE TYPE ... AS ENUM       | -    | Define enum type               |
| ⏳     | Use ENUM in table             | -    | Column with enum type          |
| ⏳     | ENUM value validation (error) | -    | Invalid enum value should fail |

---

## 7. Real-World Scenarios

### 7.1 Schema Refactoring (P1)

| Status | Test                           | File | Description                   |
| ------ | ------------------------------ | ---- | ----------------------------- |
| ⏳     | Rename column, update queries  | -    | Simulate refactoring workflow |
| ⏳     | Add column, queries still work | -    | Backward compatibility        |
| ⏳     | Drop column, old queries fail  | -    | Catch breaking changes        |

### 7.2 Copy-Paste Errors (P1)

| Status | Test                                 | File | Description                      |
| ------ | ------------------------------------ | ---- | -------------------------------- |
| ⏳     | Copy query from one table to another | -    | Column names don't match (error) |
| ⏳     | Copy-paste with wrong schema         | -    | Schema prefix mismatch (error)   |

### 7.3 Incremental Query Building (P2)

| Status | Test                         | File | Description                             |
| ------ | ---------------------------- | ---- | --------------------------------------- |
| ⏳     | Build query step-by-step     | -    | Add WHERE, JOIN, ORDER BY incrementally |
| ⏳     | Template literal composition | -    | Compose queries from parts              |

---

## 8. Edge Cases & Error Handling

### 8.1 Null Handling (P1)

| Status | Test                             | File | Description                       |
| ------ | -------------------------------- | ---- | --------------------------------- |
| ⏳     | NULL in WHERE clause             | -    | `WHERE col IS NULL`               |
| ⏳     | NULL in comparison               | -    | `WHERE col = NULL` (should warn?) |
| ⏳     | Nullable vs non-nullable columns | -    | Type system reflects nullability  |

### 8.2 Ambiguous References (P1)

| Status | Test                             | File               | Description                            |
| ------ | -------------------------------- | ------------------ | -------------------------------------- |
| ✅     | Ambiguous column in JOIN (error) | `05-joins.test.ts` | `SELECT id` when both tables have `id` |
| ⏳     | Qualified column reference       | -                  | `SELECT users.id` resolves ambiguity   |

### 8.3 Type Coercion (P2)

| Status | Test                     | File | Description                         |
| ------ | ------------------------ | ---- | ----------------------------------- |
| ⏳     | Implicit type conversion | -    | `WHERE text_col = 123` (if allowed) |
| ⏳     | Explicit CAST            | -    | `CAST(col AS type)`                 |
| ⏳     | Invalid CAST (error)     | -    | Incompatible types should fail      |

### 8.4 Case Sensitivity (P2)

| Status | Test                                | File | Description              |
| ------ | ----------------------------------- | ---- | ------------------------ |
| ⏳     | Unquoted identifiers (lowercase)    | -    | `SELECT Name` → `name`   |
| ⏳     | Quoted identifiers (case-sensitive) | -    | `SELECT "Name"` → `Name` |
| ⏳     | Mixed case mismatch (error)         | -    | Should fail              |

---

## Summary

### Current Status

- **Total tests planned**: ~120
- **Implemented**: 11 (9%)
- **In progress**: 0
- **Planned**: 109 (91%)

### Priority Breakdown

- **P0 (Critical)**: 25 tests (11 implemented, 14 planned)
- **P1 (High)**: 45 tests (0 implemented, 45 planned)
- **P2 (Medium)**: 40 tests (0 implemented, 40 planned)
- **P3 (Low)**: 10 tests (0 implemented, 10 planned)

### Next Steps

1. Implement remaining P0 tests (critical functionality)
2. Implement P1 tests (common use cases)
3. Implement P2 tests (edge cases)
4. Implement P3 tests (nice-to-have)

### Test Implementation Order

**Phase 1: Complete P0 Coverage**

1. SELECT \* expansion
2. SELECT with aliases
3. SELECT from qualified table
4. SELECT from unknown table (error)
5. Multiple JOINs
6. INSERT multiple rows
7. INSERT missing required column (error)
8. UPDATE multiple columns
9. DELETE without WHERE

**Phase 2: P1 Common Use Cases**

1. WHERE clause operators (!=, <, >, IN, BETWEEN, IS NULL)
2. Subqueries (scalar, IN, EXISTS)
3. GROUP BY and aggregation
4. Built-in functions
5. Real-world refactoring scenarios

**Phase 3: P2 Edge Cases**

1. CTEs
2. Advanced JOINs (RIGHT, FULL OUTER, CROSS)
3. Schema operations (CREATE, ALTER, DROP)
4. PostgreSQL arrays
5. Null handling and type coercion

**Phase 4: P3 Nice-to-Have**

1. JSON/JSONB support
2. ENUM types
3. Advanced edge cases
