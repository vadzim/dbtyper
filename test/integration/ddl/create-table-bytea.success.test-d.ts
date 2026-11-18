// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: bytea (binary data)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table files (id integer not null, data bytea not null);`)
	.database()

const _result = await _db.query(`select id, data from files;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			data: Uint8Array
		}[]
	>(),
)
