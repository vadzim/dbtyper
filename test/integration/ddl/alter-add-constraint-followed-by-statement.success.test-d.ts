// Integration Test: PGT-19 ALTER TABLE ADD CONSTRAINT / SET DEFAULT / DROP DEFAULT may be followed by statements
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null, n int not null);`)
	.apply(`alter table t add unique (id); alter table t add unique (id);`)
	.apply(`alter table t add primary key (id); select 1 as x;`)
	.apply(
		`alter table t alter column n set default 1; alter table t alter column n drop default; alter table t drop column n;`,
	)
	.database()

const _result = await db.query(`select id from t;`)
expectType<typeof _result>(toBe<{ id: number }[]>())
