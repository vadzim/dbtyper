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
// ✅ SUCCESS: Query tables from different schemas

const _result = await db.query(`
		select t.id, a.id
		from public.tasks t
		join app.articles a on t.id = a.id;
	`)

type _check = Expect<
	Matches<
		typeof result,
		{
			id: number
		}[]
	>
>
