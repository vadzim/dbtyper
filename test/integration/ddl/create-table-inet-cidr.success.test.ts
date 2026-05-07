// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: inet and cidr (network addresses)

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`)
	.database()

const result = await db.query(`select id, ip, subnet from hosts;`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
			ip: unknown
			subnet: unknown
		}[]
	>
>
