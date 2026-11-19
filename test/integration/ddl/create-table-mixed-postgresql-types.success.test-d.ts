// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// // TYPE-3: serial -> number, timestamptz -> Date
// ✅ SUCCESS: mixed types in one table

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table mixed_types (
				id serial not null,
				created timestamptz not null,
				data bytea not null,
				duration interval not null,
				ip inet not null
			);`,
	)
	.database()

const _result = await _db.query(`select id, created, data, duration, ip from mixed_types;`)

expectType<typeof _result>(toBe<{ id: number; created: Date; data: Uint8Array; duration: string; ip: string }[]>())
