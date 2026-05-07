// Integration Test: Enum types across multiple schemas
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create schema app;`)
	.apply(`create type public.status as enum ('active', 'inactive');`)
	.apply(`create type app.status as enum ('draft', 'published');`)
	.apply(`create type app.priority as enum ('low', 'high');`)
	.apply(
		`create table public.tasks (
			id integer not null,
			task_status status not null
		);`,
	)
	.apply(
		`create table app.articles (
			id integer not null,
			article_status status not null,
			article_priority priority
		);`,
	)
	.database()
// ✅ SUCCESS: Use enum from app schema

const _result = await db.query(`
		insert into app.articles (id, article_status, article_priority)
		values (1, 'draft', 'high');
	`)

type _check = Expect<Matches<typeof _result, unknown>>
