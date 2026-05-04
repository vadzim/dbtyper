// Integration Test: SELECT edge cases
// Tests for NULL handling, type validation, JOINs, subqueries, and various SELECT scenarios

import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {},
}

// ============================================================================
// WHERE clause edge cases
// ============================================================================

async function testSelectWhereTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ❌ ERROR: WHERE clause type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`select * from users where age = 'not a number';`,
	)

	return bad
}

async function testSelectWhereIsNull() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: WHERE column IS NULL
	const result = await db.query(`select * from users where name is null;`)

	return result
}

async function testSelectWhereIsNotNull() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: WHERE column IS NOT NULL
	const result = await db.query(`select * from users where name is not null;`)

	return result
}

async function testSelectWhereIn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: WHERE column IN (list)
	const result = await db.query(`select * from users where id in ('1', '2', '3');`)

	return result
}

async function testSelectWhereBetween() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer);`)
		.database()

	// ✅ SUCCESS: WHERE column BETWEEN
	const result = await db.query(`select * from users where age between 18 and 65;`)

	return result
}

async function testSelectWhereAndOr() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, age integer, active boolean);`)
		.database()

	// ✅ SUCCESS: WHERE with AND/OR
	const result = await db.query(`select * from users where (age > 18 and active = true) or id = 'admin';`)

	return result
}

// ============================================================================
// Multiple JOINs
// ============================================================================

async function testSelectMultipleInnerJoins() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.apply(`create table comments (id text, post_id text, content text);`)
		.database()

	// ✅ SUCCESS: multiple INNER JOINs
	const result = await db.query(
		`select users.name, posts.title, comments.content 
     from users 
     inner join posts on users.id = posts.user_id 
     inner join comments on posts.id = comments.post_id;`,
	)

	return result
}

async function testSelectMultipleLeftJoins() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.apply(`create table comments (id text, post_id text, content text);`)
		.database()

	// ✅ SUCCESS: multiple LEFT JOINs (nullability propagates)
	const result = await db.query(
		`select users.name, posts.title, comments.content 
     from users 
     left join posts on users.id = posts.user_id 
     left join comments on posts.id = comments.post_id;`,
	)

	return result
}

async function testSelectMixedJoins() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.apply(`create table comments (id text, post_id text, content text);`)
		.database()

	// ✅ SUCCESS: mixed INNER and LEFT JOINs
	const result = await db.query(
		`select users.name, posts.title, comments.content 
     from users 
     inner join posts on users.id = posts.user_id 
     left join comments on posts.id = comments.post_id;`,
	)

	return result
}

async function testSelectCrossJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table roles (id text, role_name text);`)
		.database()

	// ✅ SUCCESS: CROSS JOIN (Cartesian product)
	const result = await db.query(`select users.name, roles.role_name from users cross join roles;`)

	return result
}

async function testSelectSelfJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, manager_id text);`)
		.database()

	// ✅ SUCCESS: self-join
	const result = await db.query(
		`select u1.name as employee, u2.name as manager 
     from users u1 
     left join users u2 on u1.manager_id = u2.id;`,
	)

	return result
}

async function testSelectJoinTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id integer, user_id text, title text);`)
		.database()

	// ❌ ERROR: JOIN condition type mismatch (text vs integer)
	const bad = await db.query(
		// @ts-expect-error
		`select * from users inner join posts on users.id = posts.id;`,
	)

	return bad
}

// ============================================================================
// Subqueries
// ============================================================================

async function testSelectScalarSubquery() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: scalar subquery in SELECT
	const result = await db.query(
		`select id, name, (select count(*) from posts where posts.user_id = users.id) as post_count from users;`,
	)

	return result
}

async function testSelectSubqueryInWhere() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: subquery in WHERE with IN
	const result = await db.query(`select * from users where id in (select user_id from posts);`)

	return result
}

async function testSelectSubqueryExists() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: subquery with EXISTS
	const result = await db.query(
		`select * from users where exists (select 1 from posts where posts.user_id = users.id);`,
	)

	return result
}

async function testSelectCorrelatedSubquery() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text, created_at text);`)
		.database()

	// ✅ SUCCESS: correlated subquery
	const result = await db.query(
		`select * from posts p1 
     where created_at = (select max(created_at) from posts p2 where p2.user_id = p1.user_id);`,
	)

	return result
}

async function testSelectSubqueryTypeMismatch() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id integer);`)
		.database()

	// ❌ ERROR: subquery type mismatch
	const bad = await db.query(
		// @ts-expect-error
		`select * from users where id in (select user_id from posts);`,
	)

	return bad
}

// ============================================================================
// CTEs (Common Table Expressions)
// ============================================================================

async function testSelectSimpleCTE() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: simple CTE
	const result = await db.query(
		`with active_users as (select * from users where id is not null) 
     select * from active_users;`,
	)

	return result
}

async function testSelectMultipleCTEs() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: multiple CTEs
	const result = await db.query(
		`with 
       active_users as (select * from users where id is not null),
       user_posts as (select * from posts where user_id is not null)
     select * from active_users 
     inner join user_posts on active_users.id = user_posts.user_id;`,
	)

	return result
}

async function testSelectCTEInJoin() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: CTE used in JOIN
	const result = await db.query(
		`with post_counts as (
       select user_id, count(*) as count from posts group by user_id
     )
     select users.name, post_counts.count 
     from users 
     left join post_counts on users.id = post_counts.user_id;`,
	)

	return result
}

async function testSelectCTEUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: reference unknown column from CTE
	const bad = await db.query(
		// @ts-expect-error
		`with active_users as (select id, name from users) 
     select invalid_column from active_users;`,
	)

	return bad
}

// ============================================================================
// Aggregate functions and GROUP BY
// ============================================================================

async function testSelectGroupBySingleColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ✅ SUCCESS: GROUP BY single column
	const result = await db.query(`select user_id, count(*) as post_count from posts group by user_id;`)

	return result
}

async function testSelectGroupByMultipleColumns() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, category text);`)
		.database()

	// ✅ SUCCESS: GROUP BY multiple columns
	const result = await db.query(`select user_id, category, count(*) as count from posts group by user_id, category;`)

	return result
}

async function testSelectHaving() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text);`)
		.database()

	// ✅ SUCCESS: HAVING clause
	const result = await db.query(`select user_id, count(*) as count from posts group by user_id having count(*) > 5;`)

	return result
}

async function testSelectInvalidGroupBy() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table posts (id text, user_id text, title text);`)
		.database()

	// ❌ ERROR: SELECT non-grouped column without aggregate
	const bad = await db.query(
		// @ts-expect-error
		`select user_id, title, count(*) from posts group by user_id;`,
	)

	return bad
}

// ============================================================================
// ORDER BY and LIMIT
// ============================================================================

async function testSelectOrderBy() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text, age integer);`)
		.database()

	// ✅ SUCCESS: ORDER BY
	const result = await db.query(`select * from users order by age desc, name;`)

	return result
}

async function testSelectLimit() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: LIMIT
	const result = await db.query(`select * from users limit 10;`)

	return result
}

async function testSelectLimitOffset() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ✅ SUCCESS: LIMIT with OFFSET (pagination)
	const result = await db.query(`select * from users limit 10 offset 20;`)

	return result
}

async function testSelectOrderByUnknownColumn() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create table users (id text, name text);`)
		.database()

	// ❌ ERROR: ORDER BY unknown column
	const bad = await db.query(
		// @ts-expect-error
		`select * from users order by invalid_column;`,
	)

	return bad
}

// Run all tests
testSelectWhereTypeMismatch()
testSelectWhereIsNull()
testSelectWhereIsNotNull()
testSelectWhereIn()
testSelectWhereBetween()
testSelectWhereAndOr()
testSelectMultipleInnerJoins()
testSelectMultipleLeftJoins()
testSelectMixedJoins()
testSelectCrossJoin()
testSelectSelfJoin()
testSelectJoinTypeMismatch()
testSelectScalarSubquery()
testSelectSubqueryInWhere()
testSelectSubqueryExists()
testSelectCorrelatedSubquery()
testSelectSubqueryTypeMismatch()
testSelectSimpleCTE()
testSelectMultipleCTEs()
testSelectCTEInJoin()
testSelectCTEUnknownColumn()
testSelectGroupBySingleColumn()
testSelectGroupByMultipleColumns()
testSelectHaving()
testSelectInvalidGroupBy()
testSelectOrderBy()
testSelectLimit()
testSelectLimitOffset()
testSelectOrderByUnknownColumn()
