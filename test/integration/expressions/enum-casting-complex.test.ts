// Integration Test: Enum type casting and complex scenarios
import { sqlMigrations } from "../../../src/core/sql-database.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

async function testEnumCastingAndComplexScenarios() {
	const db = sqlMigrations({ driver: mockDriver })
		.apply(`create schema public;`)
		.apply(`create type status as enum ('active', 'inactive', 'pending');`)
		.apply(`create type priority as enum ('low', 'medium', 'high');`)
		.apply(`create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority
		);`)
		.database()

	// ✅ SUCCESS: Cast string to enum type
	const result1 = await db.query(`
		select 'active'::status as status_value;
	`)

	// ✅ SUCCESS: Cast in WHERE clause
	const result2 = await db.query(`
		select * from tasks
		where task_status = 'active'::status;
	`)

	// ✅ SUCCESS: CASE expression with enum
	const result3 = await db.query(`
		select
			id,
			case task_status
				when 'active' then 'Running'
				when 'pending' then 'Waiting'
				else 'Stopped'
			end as status_label
		from tasks;
	`)

	// ✅ SUCCESS: Enum in ORDER BY
	const result4 = await db.query(`
		select * from tasks
		order by task_status, task_priority;
	`)

	// ✅ SUCCESS: Enum in GROUP BY
	const result5 = await db.query(`
		select task_status, count(*) as cnt
		from tasks
		group by task_status;
	`)

	// ✅ SUCCESS: Multiple enum columns in WHERE with AND
	const result6 = await db.query(`
		select * from tasks
		where task_status = 'active' and task_priority = 'high';
	`)

	// ✅ SUCCESS: Enum with BETWEEN (works because enums have ordering)
	const result7 = await db.query(`
		select * from tasks
		where task_status between 'active' and 'pending';
	`)

	// ✅ SUCCESS: Enum comparison with <>
	const result8 = await db.query(`
		select * from tasks
		where task_status <> 'inactive';
	`)

	// ✅ SUCCESS: Enum in subquery
	const result9 = await db.query(`
		select * from tasks
		where task_status in (
			select 'active'::status
		);
	`)

	// ✅ SUCCESS: Enum with COALESCE
	const result10 = await db.query(`
		select id, coalesce(task_priority, 'low'::priority) as effective_priority
		from tasks;
	`)

	return {
		result1,
		result2,
		result3,
		result4,
		result5,
		result6,
		result7,
		result8,
		result9,
		result10,
	}
}

testEnumCastingAndComplexScenarios()
