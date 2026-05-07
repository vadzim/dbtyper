// Integration Test: UPDATE with enum types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { ExtractQueryError } from "../../test-utils/error-test-utils.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import type { SqlParserError } from "../../../src/sql-parser-error.ts"
import type { ApplyStatements } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"

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

// ❌ ERROR: NULL for NOT NULL enum column (caught at compile-time)
const query = `
		update tasks
		set task_status = null
		where id = 6;
	` as const

// @ts-expect-error
await db.query(query)

// Type-level database shape for error checking
type DbShape = ApplyStatements<
	SqlDatabase,
	`create schema public; create type status as enum ('active', 'inactive', 'pending'); create type priority as enum ('low', 'medium', 'high'); create table tasks (
			id integer not null,
			name text not null,
			task_status status not null,
			task_priority priority
		);`
>[0]

type _errorCheck = Expect<Matches<
	ExtractQueryError<DbShape, typeof query>,
	SqlParserError<"NULL not allowed for NOT NULL column">
>>
