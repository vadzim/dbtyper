// Integration Test: _db․stream() rejects non-RETURNING statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.database()

// ✅ SELECT should be accepted by stream()

const _result = await Array.fromAsync(await _db.stream(`select id, name from users;`))

// Stream should yield typed objects

type _check = Expect<
	Matches<
		typeof _result,
		Array<{
			id: string
			name: string
		}>
	>
>
