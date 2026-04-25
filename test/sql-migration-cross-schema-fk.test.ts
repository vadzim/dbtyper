/**
 * Migration DDL: cross-schema foreign keys and referenced-schema gating at apply time.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { JsqlTableConstraintsKey } from "../src/engine/table-constraint-meta.ts"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

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
	>[1]
>
type _ApplyCrossSchemaFkOk = Expect<
	Matches<
		ApplyCrossSchemaFkOk,
		{
			kind: "database"
			defaultSchema: "app"
			schemas: {
				auth: { users: { id: number } }
				app: {
					members: { uid: number } & {
						[J in JsqlTableConstraintsKey]: {
							m_uid_fk: {
								kind: "foreign_key"
								refs: {
									from: ""
									columnPairs: [["uid", "id"]]
									toSchema: "auth"
									toTable: "users"
								}
							}
						}
					}
				}
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
	>[1]
>
type _ApplyCrossSchemaFkMissingSchema = Expect<
	Matches<ApplyCrossSchemaFkMissingSchema, SqlParserError<`Unknown referenced schema "missing" in database`>>
>

describe("sql migration cross-schema fk (type tests)", () => {
	it("should run", () => {})
})
