// Integration Test: CREATE TABLE with PostgreSQL-specific types
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

// ✅ SUCCESS: tsvector and tsquery (full-text search)

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table documents (id integer not null, search_vector tsvector not null, search_query tsquery not null);`,
	)
	.database()

const _result = await _db.query(`select id, search_vector, search_query from documents;`)

expectType<typeof _result>(
	toBe<
		{
			id: number
			search_vector: string
			search_query: string
		}[]
	>(),
)
