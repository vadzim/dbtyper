// Integration Test: SELECT without FROM - subquery (not supported)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver }).apply(`create schema public;`).database()

// ❌ ERROR: SELECT without FROM in subquery is not supported

const result = db.query(
	// @ts-expect-error
	`select (select 1);`,
)

type _check = Expect<
	typeof result extends Promise<
		Array<{
			"?column?": number
		}>
	>
		? false
		: true
>
