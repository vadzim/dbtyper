// Integration Test: STMT-18 statements with a known keyword that dbtyper does not type are skipped
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table users (id int not null);
		grant select on users to bob;
		create index i on users (id);
		comment on table users is 'x';
		set search_path to public;
		begin; commit;`,
	)
	.database()

const _result = await db.query(`set search_path to public; select id from users;`)
expectType<typeof _result>(toBe<Array<{ id: number }>>())
