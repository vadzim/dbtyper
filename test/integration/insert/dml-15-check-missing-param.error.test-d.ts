// Integration Test: DML-15 Check: with only { id } the missing parameter is 2400
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id text not null, name text not null, email text); create table users_backup (id text not null, name text not null);`,
	)
	.database()

// ❌ ERROR: DML-15
const query = `insert into users (id, name) values (:id, :name) returning *;` as const

// @ts-expect-error
await db.query(query, { id: "u" })

type ReturnedError = GetQueryError<typeof db, typeof query, { id: string }>

expectType<ReturnedError>(toBe<DbtyperError<2400, "Unknown query parameter: name">>())
