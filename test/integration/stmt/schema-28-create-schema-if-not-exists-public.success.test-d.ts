// Integration Test: SCHEMA-28 `create schema if not exists public;` on PostgreSQL is a no-op
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: the schema exists already, so the statement changes nothing and the table follows
const _db = sqlMigrations({ driver: mockDriver }).apply(
	`create schema if not exists public; create table t (id int not null);`,
)
