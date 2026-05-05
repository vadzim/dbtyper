// Integration Test: UPDATE with enum types
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
// Wrong enum type (runtime failure, not compile-time)
const result = await db.query(`
		update tasks
		set task_status = 'high'
		where id = 5;
	`)
type _check = Expect<Matches<typeof result, unknown>>
