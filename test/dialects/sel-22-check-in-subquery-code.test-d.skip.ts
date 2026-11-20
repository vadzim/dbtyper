// Integration Test (SKIPPED, SPEC-Q SEL-22): the Check says an IN-subquery type mismatch is dbtyper:2504,
// the code (and DECISIONS, review-175-batch2) gives 2505 "Incompatible types in IN subquery"; 2504 is the IN list.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null);
		 create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

const q = `select id from users where name in (select user_id from posts);` as const
// @ts-expect-error
await db.query(q)
// SEL-22
expectType<GetQueryError<typeof db, typeof q>>(toBe<DbtyperError<2504, "Incompatible types in IN list">>())
