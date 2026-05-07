// Integration Test: JOIN smoke tests - LEFT JOIN
// Integration Test: JOIN statements
// Minimal tests demonstrating API functionality

import { sqlMigrations } from "../../../src/core/sql-database.ts"
import type { Expect, Matches } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id text, name text);`)
	.apply(`create table posts (id text, user_id text, title text);`)
	.database()
// ✅ SUCCESS: LEFT JOIN

const _result = await db.query(`select users.name, posts.title from users left join posts on users.id = posts.user_id;`)

type _check = Expect<
	Matches<
		typeof _result,
		{
			name: string
			title: string
		}[]
	>
>
