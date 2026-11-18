// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: inet and cidr (network addresses)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`)
	.database()

const _result = await _db.query(`select id, ip, subnet from hosts;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			ip: string
			subnet: string
		}[]
	>(),
)
