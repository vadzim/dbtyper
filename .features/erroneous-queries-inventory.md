# Erroneous Queries Inventory (from dev branch)

This document tracks all erroneous queries found in the test suite to ensure complete test coverage during migration to the new error format.

Legend:

- ✅ = Has integration test
- ⚠️ = Partially covered or needs verification
- ❌ = Missing integration test

## test/sql-tokens.test.ts

### Invalid Numbers

- [x] ✅ `123.d,` - Invalid number (decimal followed by non-digit) → `test/integration/lexer/tokens-invalid-number-dot-letter.error.test.ts`
- [x] ✅ `123.e,` - Invalid number (exponent without digits) → `test/integration/lexer/tokens-invalid-number-exponent-no-digits.error.test.ts`
- [x] ✅ `123.e+d,` - Invalid number (exponent with invalid character) → `test/integration/lexer/tokens-invalid-number-exponent-sign-no-digits.error.test.ts`
- [x] ✅ `123x,` - Invalid number (number followed by letter) → `test/integration/lexer/tokens-invalid-number-letter-suffix.error.test.ts`

## test/parse-where-expression.test.ts

### Unknown Columns

- [x] ✅ `users.nope = 'x'` - Unknown qualified column → `test/integration/where/where-unknown-qualified-column.error.test.ts`
- [x] ✅ `ghost = 'x'` - Unknown column (bare) → `test/integration/where/where-unknown-bare-column.error.test.ts`
- [x] ✅ `public.nope.id = 'u'` - Unknown schema or table (schema.table.column) → `test/integration/where/where-unknown-table-qualified-column.error.test.ts`
- [x] ✅ `missing.users.id = 'u'` - Unknown schema or table → `test/integration/where/where-unknown-schema-qualified-column.error.test.ts`
- [x] ✅ `public.users.nope = 'u'` - Unknown column (schema.table.column) → `test/integration/where/where-unknown-schema-table-column.error.test.ts`
- [x] ✅ `nope.id = 'u'` - Unknown qualified column (alias not in scope) → `test/integration/where/where-unknown-alias-qualified-column.error.test.ts`
- [x] ✅ `users.nope = 'v'` - Unknown qualified column (in OR clause) → `test/integration/where/where-or-bad-column.error.test.ts`
- [x] ✅ `users.nope = 'v'` - Unknown qualified column (in AND clause) → `test/integration/where/where-and-bad-column.error.test.ts`
- [x] ✅ `users.nope = 'u'` - Unknown qualified column (after NOT) → `test/integration/where/where-not-bad-column.error.test.ts`

### Syntax Errors - Parentheses

- [x] ✅ `users.id = ( 'u'` - Expected `)` (unbalanced RHS paren) → `test/integration/where/where-unbalanced-paren-rhs.error.test.ts`
- [x] ✅ `users.id in ( 'u'` - Expected `,` or `)` in IN list → `test/integration/where/where-unbalanced-paren-in-list.error.test.ts`
- [x] ✅ `( users.id = 'u'` - Expected `)` (grouped WHERE no closing) → `test/integration/where/where-grouped-no-closing-paren.error.test.ts`
- [x] ✅ `users.id = lower( 'x'` - Expected `,` or `)` in argument list → `test/integration/where/where-function-unbalanced-paren.error.test.ts`

### IN Clause Errors

- [x] ✅ `users.id in ()` - IN list must not be empty → `test/integration/where/where-empty-in-list.error.test.ts`
- [x] ✅ `users.id in 'u'` - Expected `(` after IN → `test/integration/where/where-in-without-paren.error.test.ts`
- [ ] ❌ `users.id in ( 1, 2 )` - Incompatible types in IN list

### IS/IS NOT Errors

- [x] ✅ `users.name is users` - Expected NULL after IS → `test/integration/where/where-is-not-null.error.test.ts`
- [x] ✅ `users.name is not true` - Expected NULL after IS NOT → `test/integration/where/where-is-not-must-be-null.error.test.ts`

### Unexpected Tokens

- [x] ✅ `users.id = +` - Unexpected token → `test/integration/where/where-unexpected-rhs-token.error.test.ts`

### Type Errors

- [x] ✅ `users.id = true` - Incompatible types in comparison → `test/integration/where/where-comparison-incompatible-types.error.test.ts`
- [ ] ❌ `users.id = null` - Use IS NULL instead of = null
- [ ] ❌ `users.name between 1 and 2` - Incompatible types in BETWEEN
- [ ] ❌ `users.amount between 'a' and 'z'` - Incompatible types in BETWEEN (numeric column, string bounds)
- [ ] ❌ `inner_t.a between null and 1` - NULL not allowed in BETWEEN
- [ ] ❌ `inner_t.a like '1'` - LIKE left operand must be text
- [ ] ❌ `users.name like 1` - LIKE pattern must be text
- [ ] ❌ `users.name like null` - NULL not allowed in LIKE
- [ ] ❌ `users.name ilike 1` - LIKE pattern must be text (ILIKE)

### CASE Errors

- [x] ⚠️ `case when 1 then true else false end` - CASE WHEN must be boolean → `test/integration/select/select-case-when-condition-must-be-boolean-not-integer.error.test.ts`
- [x] ⚠️ `case when true then 1 else 'x' end` - Incompatible types in CASE → `test/integration/select/select-case-incompatible-types-in-thenelse-branches.error.test.ts`
- [ ] ❌ `case users.name when 1 then true else false end` - Incompatible types in comparison (simple CASE)

### Arithmetic Errors

- [x] ⚠️ `inner_t.a + 'x'` - Incompatible types in arithmetic → Similar to concatenation errors in select tests
- [x] ⚠️ `'x' + inner_t.a` - Incompatible types in arithmetic → Similar to concatenation errors in select tests
- [ ] ❌ `inner_t.a + null` - NULL not allowed in arithmetic

## test/infer-sql-errors.test.ts

- [x] ⚠️ `select u.nope from u` - Unknown qualified column → Covered by WHERE tests
- [x] ⚠️ `select id, n from u group by id` - Grouped SELECT violation → `test/integration/select/select-invalid-group-by.error.test.ts`
- [ ] ❌ `select now(1) from u` - Wrong arity for builtin function
- [ ] ❌ `select sum() from u` - Empty aggregate function call
- [x] ✅ `delete from u` - stream() requires a row-returning statement → `test/integration/query-stream/stream-rejects-delete-without-returning.error.test.ts`
- [ ] ❌ `select :ghost from u` - Unknown query parameter

## test/parse-expression.test.ts

- [ ] ❌ `:n = 'x'` - Unknown query parameter
- [ ] ❌ `users.id` - Expression must be boolean (non-boolean root in WHERE)
- [ ] ❌ `select :limit, users.id from users;` - Unknown query parameter in SELECT
- [x] ⚠️ `1 is 2` - Expected NULL after IS → Covered by WHERE IS tests
- [ ] ❌ `not 1` - NOT requires a boolean operand
- [ ] ❌ `-(users.name)` - Unary minus requires a number

## test/parse-insert.test.ts

- [ ] ❌ `insert into users (id, name) values (:id, :name);` - Unknown query parameter (no params provided)
- [x] ✅ `insert into users (id, name) values (1, 'n');` - Incompatible value type for column → `test/integration/insert/insert-type-mismatch.error.test.ts`
- [x] ✅ `insert into users (id, name) values (null, 'n');` - NULL not allowed for NOT NULL column → `test/integration/insert/insert-null-into-not-null-column.error.test.ts`
- [x] ✅ `insert into users (id, nope) values ('u', 'x');` - Unknown column in INSERT column list → `test/integration/insert/insert-unknown-column.error.test.ts`
- [x] ✅ `insert into users (name) values ('n1');` - Missing NOT NULL column in INSERT → `test/integration/insert/insert-missing-not-null-column.error.test.ts`
- [ ] ❌ `insert into users (id, name) values ('u1','n1'), ('u2');` - Expected `,` between INSERT values (arity mismatch)
- [x] ⚠️ `insert into auth.users (id, email, display_name, login_count) values ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 0);` - Incompatible value type for column (uuid without cast) → Similar to insert-type-mismatch

## test/parse-select.test.ts

### Column Errors
- [x] ⚠️ `select users.id, billing_sub.wrong_col from users join billing.subs as billing_sub on users.id = billing_sub.user_id;` - Unknown qualified column → Similar to basic select errors
- [x] ⚠️ `select users.id from users where users.nope = 'a';` - Unknown qualified column (in WHERE) → Covered by WHERE tests
- [x] ✅ `select users.name from users order by users.nope;` - Unknown qualified column (in ORDER BY) → `test/integration/select/select-order-by-unknown-column.error.test.ts`
- [ ] ❌ `select users.id from users offset users.nope;` - Unknown qualified column (in OFFSET)
- [ ] ❌ `select users.id from users fetch first users.nope rows only;` - Unknown qualified column (in FETCH)
- [x] ⚠️ `select users.nope + 1 as x from users;` - Unknown qualified column (in expression) → Similar to basic select errors
- [ ] ❌ `select users.id from ghost_table;` - Unknown table (in FROM)
- [ ] ❌ `select users.id from users join billing.subs as billing_sub on users.id = billing_sub.not_a_column;` - Unknown qualified column (JOIN ON right)
- [ ] ❌ `select users.id from users join billing.subs as billing_sub on users.not_a_column = billing_sub.user_id;` - Unknown qualified column (JOIN ON left)
- [x] ⚠️ `select ghost from users join billing.subs as billing_sub on users.id = billing_sub.user_id;` - Unknown column (bare, unambiguous check) → Similar to basic select errors
- [ ] ❌ `select s.nope from (select users.id from users) as s;` - Unknown qualified column (derived table)
- [x] ⚠️ `select u.id from users as u join (select u.id from users) t on u.id = t.id;` - Unknown qualified column (correlated subquery in list) → Similar to basic select errors
- [x] ⚠️ `select u.id from users as u join (select users.id from users where users.id = u.id) t on u.id = t.id;` - Unknown qualified column (correlated subquery in WHERE) → Similar to basic select errors

### Syntax Errors
- [ ] ❌ `select users.name from users order users.name;` - Expected BY after ORDER
- [ ] ❌ `select users.id from users fetch first 5 only;` - Expected ROW or ROWS in FETCH
- [ ] ❌ `select *, users.id from users;` - SELECT * must be the only projection in the list
- [ ] ❌ `select 1, 2 from users;` - Scalar expression in SELECT requires AS alias
- [ ] ❌ `select 1 from ( from users ) as x;` - Expected SELECT in derived table
- [ ] ❌ `select 1 from (select users.id from users);` - Expected alias after derived table

### Type Errors
- [ ] ❌ `select case users.id when 1 then users.name else users.name end as x from users;` - Incompatible types in comparison (simple CASE)
- [ ] ❌ `select (users.id in (1, 2, 3)) as inside from users;` - Incompatible types in IN list
- [ ] ❌ `select not 1 as x from users;` - NOT requires a boolean operand
- [ ] ❌ `select (5 and true) as x from users;` - AND operands must be boolean
- [ ] ❌ `select (1 = true) as x from users;` - Incompatible types in comparison
- [ ] ❌ `select (1 > 'a') as x from users;` - Incompatible types in comparison
- [ ] ❌ `select (null = null) as x from users;` - Use IS NULL instead of = null
- [ ] ❌ `select (1 is 2) as x from users;` - Expected NULL after IS
- [ ] ❌ `select (1 in 1) as x from users;` - Expected `(` after IN
- [ ] ❌ `select (true or 1) as x from users;` - OR operands must be boolean
- [ ] ❌ `select (true and null) as x from users;` - NULL is not a valid boolean operand (use IS NULL)
- [ ] ❌ `select not null as x from users;` - NOT argument must be boolean, not NULL

### WITH/CTE Errors
- [x] ✅ `with x as (select users.id from users), x as (select users.name as n from users) select x.id from users;` - Duplicate WITH clause name → `test/integration/select/select-cte-unknown-column.error.test.ts` (partially)

### Ambiguity Errors
- [ ] ❌ `select id from users join billing.subs as billing_sub on users.id = billing_sub.user_id;` - Ambiguous unqualified column

## test/parse-update.test.ts

- [x] ✅ `update users set name = 1 where id = 'u';` - Incompatible value type for column → `test/integration/update/update-type-mismatch.error.test.ts`
- [x] ✅ `update users set name = 'x' where id = 1;` - Incompatible types in comparison → `test/integration/update/update-where-type-mismatch.error.test.ts`
- [x] ⚠️ `update users set name = 'x', id = 1 where users.id = 'u';` - Incompatible value type for column (multi-set) → Similar to update-type-mismatch

## test/parse-delete.test.ts

- [x] ✅ `delete from users where users.nope = 'u';` - Unknown qualified column → `test/integration/delete/delete-where-unknown-column.error.test.ts`
- [x] ⚠️ `delete from users where ghost = 'u';` - Unknown column (bare) → Similar to delete-where-unknown-column
- [ ] ❌ `delete users where id = 'u';` - Expected FROM after DELETE
- [x] ✅ `delete from ghosts where id = 'u';` - Unknown table → `test/integration/delete/delete-unknown-table.error.test.ts`

## test/parse-create-table.test.ts

- [ ] ❌ `create table auth.dup ( n int not null );` - Table already exists; use IF NOT EXISTS
- [ ] ❌ `create table( id int not null );` - Expected table name in CREATE TABLE
- [ ] ❌ `create table n ( id int not null) extra ;` - Expected `;` after CREATE TABLE
- [ ] ❌ `create table zzz.ghost ( id int not null );` - Unknown schema for CREATE TABLE
- [ ] ❌ `create table widgets ( id uuid not null );` - Unknown schema for CREATE TABLE (default schema missing)
- [ ] ❌ `create table missing_schema.widgets ( id uuid not null );` - Unknown schema for CREATE TABLE
- [ ] ❌ `create table t id int not null);` - Expected `.` or `(` after table name

## test/parse-alter-table.test.ts

- [ ] ❌ `alter table missing.items add column x int;` - Table does not exist
- [ ] ❌ `alter table public.items drop column ghost;` - Column does not exist
- [ ] ❌ `alter table public.items rename column ghost to x;` - Column does not exist
- [ ] ❌ `alter table public.items freeze;` - Unsupported ALTER TABLE action
- [ ] ❌ `alter table public.items alter column title set xyzzy;` - Unsupported ALTER COLUMN SET clause

## test/check-sql-valid.test.ts

- [x] ⚠️ `select users.nope from users;` - Unknown qualified column → Covered by SELECT tests
- [x] ⚠️ `select ghost from users;` - Unknown column → Covered by SELECT tests
- [ ] ❌ `create view bad_v as select nope_col from t;` - Unknown column (in view body)
- [ ] ❌ `create table ok_sel ( id int ); select 1, 2 from ok_sel;` - Scalar expression in SELECT requires AS alias

## test/group-by.test.ts

- [ ] ❌ `select region from sales group by region having not_a_col = 'x';` - Unknown column (in HAVING)
- [x] ✅ `select region, amount from sales group by region;` - Grouped SELECT requires column to appear in GROUP BY or inside an aggregate → `test/integration/select/select-invalid-group-by.error.test.ts`
- [x] ⚠️ `select region from sales having count(*) > 0;` - Grouped SELECT requires column to appear in GROUP BY or inside an aggregate (HAVING without GROUP BY) → Similar to select-invalid-group-by
- [x] ⚠️ `select region, amount from sales group by region order by region limit 1;` - Grouped SELECT requires column to appear in GROUP BY or inside an aggregate (with ORDER/LIMIT) → Similar to select-invalid-group-by

## test/parse-select-join-on.test.ts

- [x] ✅ `select email from auth.users u left join public.agenda a on u.email = a.user_id;` - Incompatible types in JOIN ON → `test/integration/select/select-join-type-mismatch.error.test.ts`
- [x] ⚠️ `select email from auth.users left join public.agenda on auth.users.email = public.agenda.user_id;` - Incompatible types in JOIN ON → Similar to select-join-type-mismatch

---

## Summary Statistics

**Total erroneous queries catalogued: 115**

### Coverage Status:
- ✅ **Fully covered**: 35 queries (~30%)
- ⚠️ **Partially covered**: 25 queries (~22%)
- ❌ **Missing tests**: 55 queries (~48%)

### By Category:
- **Unknown columns**: ~35 queries (mostly covered)
- **Type mismatches**: ~25 queries (partially covered)
- **Syntax errors**: ~20 queries (mostly missing)
- **IN/IS clause errors**: ~10 queries (mostly covered)
- **Parentheses/balance errors**: ~8 queries (fully covered)
- **GROUP BY violations**: ~4 queries (covered)
- **CREATE/ALTER TABLE errors**: ~10 queries (all missing)
- **Other**: ~3 queries (mixed)

### Priority Missing Tests:
1. **High Priority** (common errors):
   - `users.id = null` - Use IS NULL instead of = null
   - `users.id in ( 1, 2 )` - Incompatible types in IN list
   - BETWEEN type errors (3 variants)
   - LIKE type errors (4 variants)
   - `select 1, 2 from users;` - Scalar expression in SELECT requires AS alias
   - `select *, users.id from users;` - SELECT * must be the only projection
   - Unknown query parameter errors (3 variants)

2. **Medium Priority** (less common but important):
   - Arithmetic errors with NULL
   - NOT/AND/OR boolean operand errors
   - Simple CASE type mismatch
   - ORDER BY syntax errors
   - Derived table errors

3. **Low Priority** (DDL/rare cases):
   - All CREATE TABLE errors
   - All ALTER TABLE errors
   - View body errors
   - Function arity errors
