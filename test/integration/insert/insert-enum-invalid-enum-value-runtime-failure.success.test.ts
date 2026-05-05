// Integration Test: INSERT with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Extends, Matches } from "../../test-utils/type-test-utils.ts"

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
// Invalid enum value (runtime failure, not compile-time)
// Invalid enum value (runtime failure, not compile-time)
const result = await db.query(`
		insert into tasks (id, name, task_status)
		values (4, 'Task 4', 'invalid_status')
		returning *;
	`)
type _check = Expect<
	Matches<typeof result, { name: string; id: number; task_status: unknown; task_priority: unknown }[]>
>
