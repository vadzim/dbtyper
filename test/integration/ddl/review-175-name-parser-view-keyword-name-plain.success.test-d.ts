// Integration Test: CREATE VIEW named by a non-reserved keyword (plain name; #175 "one name parser": the view copy of
// the name parser read TokenIdent only, the others AsIdent, #165)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null);`)
	.apply(`create view type as select id from users;`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`select id from type;`)

expectType<typeof _result>(toBe<Array<{ id: number }>>())
