// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: serial types (auto-increment)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table counters (id serial not null, count bigserial not null, small smallserial not null);`)
	.database()

const _result = await _db.query(`select id, count, small from counters;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			small: unknown
			count: unknown
			id: unknown
		}[]
	>
>
