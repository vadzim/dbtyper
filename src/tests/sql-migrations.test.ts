import { describe, it } from "node:test"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { sqlDatabase, sqlStatement } from "../engine/sql-statement.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlStatements, SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { InitBuffer, SqlParseError } from "../parser/sql-tokens.js"

type ImportMigration<Path extends string, Sql extends string> = Promise<{
	default: {
		path: Path
		source: ReturnType<typeof sqlStatement<Sql>>
	}
}>

type AuthSchemaImport = ImportMigration<
	"file:///migrations/20260409093100_auth_schema.ts",
	`create schema if not exists auth`
>

type UsersImport = ImportMigration<
	"file:///migrations/20260409093300_users.ts",
	`
		create table if not exists auth.users (
			id uuid not null,
			email text not null,
			constraint users_pkey primary key (id)
		)
	`
>

type Build = ReturnType<typeof sqlDatabase<"public">>
type Apply<Builder, Arg extends Promise<{ default: { path: string; source: string } }>> = Builder extends {
	apply(arg: Arg): infer Next
}
	? Next
	: never

type DbAfterAuthSchema = Apply<Build, AuthSchemaImport>
type DbAfterUsers = Apply<DbAfterAuthSchema, UsersImport>
type _DbAfterUsers = Expect<
	Matches<ReturnType<DbAfterUsers["getMigrations"]>, Promise<{ source: string; path: string }[]>>
>

type ParsedCreate = ReturnType<
	typeof sqlStatement<`
		create table users (id int not null, email text not null)
	`>
>["__sql_parsed__"]
type _ParsedCreate = Expect<
	Matches<
		ParsedCreate,
		SqlStatements<
			InitBuffer<`
	create table users (id int not null, email text not null)
`>
		>[0]
	>
>

type ParsedArityError = ReturnType<
	typeof sqlStatement<`
		create table t (id int not null, x int, foreign key (x) references users(id, email))
	`>
>["__sql_parsed__"]
type _ParsedArityError = Expect<
	Matches<
		ParsedArityError,
		readonly [SqlParseError<"Foreign key referenced column list has more entries than the local column list">]
	>
>

/** One migration source with two statements: both are parsed into `__sql_parsed__` and both apply to the DB type. */
type MultiStatementSql = `
	create schema if not exists app;
	create table app.users (id int not null)
`
type _ParsedMulti = Expect<
	Matches<
		SqlStatementsRecovering<InitBuffer<MultiStatementSql>>[0],
		readonly [
			{ readonly kind: "create_schema"; readonly name: "app"; readonly ifNotExists: true },
			{
				readonly kind: "create_table"
				readonly name: readonly ["users", "app"]
				readonly row: { id: number }
				readonly refs: undefined
			},
		]
	>
>
type DbFromMultiMigration = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatementsRecovering<InitBuffer<MultiStatementSql>>[0]
>
type _DbFromMultiMigration = Expect<
	Matches<
		DbFromMultiMigration,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly app: {
					readonly users: { readonly id: number }
				}
			}
		}
	>
>

type MultiStatementImport = ImportMigration<"file:///migrations/20260409120000_app_users.ts", MultiStatementSql>
type DbAfterMulti = Apply<Build, MultiStatementImport>
type _DbAfterMultiMigrations = Expect<
	Matches<ReturnType<DbAfterMulti["getMigrations"]>, Promise<{ source: string; path: string }[]>>
>

describe("sql migrations", () => {
	it("should run", () => {})
})
