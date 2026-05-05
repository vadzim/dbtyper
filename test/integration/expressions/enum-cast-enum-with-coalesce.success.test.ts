// Integration Test: Enum type casting and complex scenarios
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
	},
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
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
// ✅ SUCCESS: Enum with COALESCE
const result = await db.query(`
		select id, coalesce(task_priority, 'low'::priority) as effective_priority
		from tasks;
	`)
type _check = Expect<Matches<typeof result, Array<{ id: number; effective_priority: unknown }>>>
