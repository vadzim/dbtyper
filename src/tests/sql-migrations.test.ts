import { describe, it } from "node:test"
import type { sqlDatabase, sqlStatement } from "../engine/sql-statement.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

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
	typeof sqlStatement<`create table users (id int not null, email text not null)`>
>["__sql_parsed__"]
type _ParsedCreate = Expect<
	Matches<ParsedCreate["row"], SqlStatement<`create table users (id int not null, email text not null)`>["row"]>
>

type ParsedArityError = ReturnType<
	typeof sqlStatement<`create table t (id int not null, x int, foreign key (x) references users(id, email))`>
>["__sql_parsed__"]
type _ParsedArityError = Expect<
	Matches<
		ParsedArityError["__sql_parse_error__"],
		"Foreign key referenced column list has more entries than the local column list"
	>
>

describe("sql migrations", () => {
	it("should run", () => {})
})
