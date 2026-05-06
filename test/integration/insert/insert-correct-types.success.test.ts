// Integration Test: INSERT
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { PostgresTypeMap } from "../../../src/postgres/postgres-type-map.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"

const mockDriver = {
	query: async () => [],
	scalarTypes: {
		text: "" as string,
		integer: 0 as number,
		boolean: true as boolean,
	},
}

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, age integer, active boolean);`)
	.database()
// ✅ SUCCESS: correct types

const result = await db.query(`insert into users (id, age, active) values ('1', 25, true) returning *;`)

type _check = Expect<
	Matches<
		typeof result,
		Array<{
			id: string
			age: number
			active: boolean
		}>
	>
>
