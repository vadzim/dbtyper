Skipped Integration Tests (7 files)

1. CREATE TABLE with DEFAULT values (create-table-with-defaults.test.skip.ts)
   Missing: Parser support for DEFAULT clause in column definitions

Example: age numeric default 18, active boolean default true, created_at timestamp default now()
Currently the parser skips DEFAULT expressions but doesn't parse them properly 2. CTE in JOIN (select-cte-in-join.test.skip.ts)
Missing: Full CTE (Common Table Expression) implementation

Needs: WITH cte_name AS (SELECT ...) SELECT ... FROM cte_name JOIN ...
Requires:
Parsing WITH clause and CTE definitions
Storing CTE results in scope
Making CTEs available as table sources in FROM/JOIN
Type validation for CTE columns in JOIN ON conditions
Blocked by: IS NULL support (the test uses WHERE id IS NOT NULL) 3. CTE Unknown Column (select-cte-unknown-column.test.skip.ts)
Missing: CTE column validation

Should error when referencing non-existent columns from a CTE
Example: WITH active_users AS (SELECT id, name FROM users) SELECT invalid_column FROM active_users
Requires same CTE infrastructure as #2 4. INSERT...SELECT (insert-with-select.test.skip.ts)
Missing: Subquery support in INSERT statements

Needs: INSERT INTO table (cols) SELECT cols FROM other_table
Requires:
Parsing SELECT after column list instead of VALUES
Type validation between SELECT result and INSERT columns
Column count matching 5. UPDATE...FROM (update-with-from.test.skip.ts)
Missing: FROM clause in UPDATE statements (PostgreSQL extension)

Needs: UPDATE table SET col = value FROM other_table WHERE condition
Requires:
Parsing FROM clause after SET
Merging FROM scope with UPDATE table scope
Column resolution across multiple tables in WHERE 6. DELETE...USING (delete-with-using.test.skip.ts)
Missing: USING clause in DELETE statements (PostgreSQL extension)

Needs: DELETE FROM table USING other_table WHERE condition
Requires:
Parsing USING clause after table name
Merging USING scope with DELETE table scope
Column resolution across multiple tables in WHERE 7. INSERT NOT NULL validation (insert-require-not-null-columns.test.skip.ts)
Missing: Validation that NOT NULL columns without defaults are provided in INSERT

Should error when omitting required NOT NULL columns
Example: INSERT INTO users (id) VALUES ('1') should fail if name is NOT NULL
Requires tracking which columns have DEFAULT values vs which are truly required
Summary by Feature Category
CTEs (Common Table Expressions) - 2 tests
Parse WITH clause
Store CTE definitions in scope
Validate CTE column references
Make CTEs available in FROM/JOIN
Subqueries in DML - 3 tests
INSERT...SELECT: subquery as data source
UPDATE...FROM: additional tables for updates
DELETE...USING: additional tables for deletes
DDL Enhancements - 1 test
CREATE TABLE DEFAULT clause parsing
INSERT Validation - 1 test
NOT NULL constraint checking with DEFAULT awareness
Dependencies
Most of these features are independent except:

CTE tests are blocked by IS NULL operator support (used in test queries)
INSERT NOT NULL validation requires DEFAULT clause parsing to know which columns have defaults
The implementation plan document you have (IMPLEMENTATION_PLAN_2026-05-04.md) provides detailed strategies for implementing subqueries and CTEs, which would enable most of these tests.
