// Integration Test: STMT-2 unquoted identifiers fold to lower case, quoted keep case
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table Users (Id int not null, "Name" text not null);`)
	.database()

const _result = await db.query(`SELECT ID, "Name" FROM USERS;`)

expectType<typeof _result>(toBe<{ id: number; Name: string }[]>())
