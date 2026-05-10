// Integration Test: INVALID_CREATE_TYPE_NAME_PARSE (2110)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.database()

// @ts-expect-error: Invalid CREATE TYPE name parse
const _result = _db.apply(`create type 123invalid as enum ('a', 'b');`)
