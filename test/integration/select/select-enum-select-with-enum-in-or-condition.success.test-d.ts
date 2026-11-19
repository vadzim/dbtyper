// Integration Test: SELECT with enum types - ✅ SUCCESS: Select with enum in OR condition
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create type status as enum ('active', 'inactive', 'pending');`)
	.apply(`create type priority as enum ('low', 'medium', 'high');`)
	.apply(
		`create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority
		);`,
	)
	.database()
// ✅ SUCCESS: Select with enum in OR condition

const _result = await _db.query(`select * from tasks
		where task_status = 'active' or task_status = 'pending';`)

expectType<typeof _result>(
	toBe<
		{
			name: string
			id: number
			task_status: "active" | "inactive" | "pending"
			task_priority: ("low" | "medium" | "high") | null
		}[]
	>(),
)
