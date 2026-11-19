// Integration Test: SCHEMA-27 on PostgreSQL the schema public exists from the start
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: the first migration creates a table, no `create schema public;` before it
const _db = sqlMigrations({ driver: mockDriver }).apply(`create table t0 (id int not null);`)
