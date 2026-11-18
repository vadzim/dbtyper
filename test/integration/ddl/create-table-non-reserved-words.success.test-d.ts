// Integration Test: STMT-3 — words PostgreSQL does not reserve are accepted as unquoted identifiers
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: STMT-3 `create table t1 (type text, key text);` applies without error

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t1 (type text not null, key text not null, first text not null);`)
	.apply(`insert into t1 (type, key, first) values ('a', 'b', 'c');`)
	.database()

expectType<typeof _db extends { query: unknown } ? true : false>(toBe<true>())
