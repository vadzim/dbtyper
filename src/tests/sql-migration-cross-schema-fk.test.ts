/**
 * Migration DDL: cross-schema foreign keys and referenced-schema gating at apply time.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ApplyCrossSchemaFkOk = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema auth;
		create table auth.users (id int not null);
		create schema app;
		create table app.members (uid int not null);
		alter table only app.members add constraint m_uid_fk foreign key (uid) references auth.users (id);
	`>
	>[0]
>
type _ApplyCrossSchemaFkOk = Expect<
	Matches<
		ApplyCrossSchemaFkOk,
		{
			readonly kind: "database"
			readonly defaultSchema: "app"
			readonly schemas: {
				auth: { users: { id: number } }
				app: { members: { uid: number } }
			}
		}
	>
>

type ApplyCrossSchemaFkMissingSchema = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema app;
		create table app.members (uid int not null);
		alter table app.members add constraint m_uid_fk foreign key (uid) references missing.users (id);
	`>
	>[0]
>
type _ApplyCrossSchemaFkMissingSchema = Expect<
	Matches<ApplyCrossSchemaFkMissingSchema, SqlParserError<`Unknown referenced schema "missing" in database`>>
>

describe("sql migration cross-schema fk (type tests)", () => {
	it("should run", () => {})
})
