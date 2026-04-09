import { describe, it } from "node:test"
import type { SqlApply, SqlApplyDropTable, SqlCreateTable, SqlMigration, SqlParseError } from "../sql.js"
import type { migrations } from "../migrations/migrations.js"
import type { Equal, Expect } from "./type-test-utils.js"

type SqlParseMessage<T> = T extends SqlParseError<infer M> ? M : never

type UsersImport = Promise<{
	default: SqlMigration<
		"file:///migrations/20260409093300_users.ts",
		`
			create table if not exists auth.users (
				id uuid not null,
				email text not null,
				constraint users_pkey primary key (id)
			)
		`
	>
}>

type AgendaImport = Promise<{
	default: SqlMigration<
		"file:///migrations/20260409093400_agenda.ts",
		`
			create table if not exists public.agenda (
				id uuid not null,
				user_id uuid not null,
				agenda_raw text
			)
		`
	>
}>

type AlterAgendaImport = Promise<{
	default: SqlMigration<
		"file:///migrations/20260409093500_alter_agenda.ts",
		`alter table public.agenda add column meeting_id uuid`
	>
}>

type DropAgendaImport = Promise<{
	default: SqlMigration<"file:///migrations/20260409093600_drop_agenda.ts", `drop table public.agenda`>
}>

type AlterMissingImport = Promise<{
	default: SqlMigration<"file:///migrations/20260409093700_alter_missing.ts", `alter table public.missing add column x int`>
}>

type UnsupportedImport = Promise<{
	default: SqlMigration<"file:///migrations/20260409093800_bad.ts", `create view public.v as select 1`>
}>

type Build = ReturnType<typeof migrations>
type Apply<Builder, Arg extends Promise<{ default: SqlMigration<string, string> }>> = Builder extends {
	apply(arg: Arg): infer Next
}
	? Next
	: never

type DbAfterDrop = Apply<Apply<Apply<Apply<Build, UsersImport>, AgendaImport>, AlterAgendaImport>, DropAgendaImport>
type _DbAfterDropKind = Expect<DbAfterDrop extends { readonly kind: "database" } ? true : false>
type _DbAfterDropSchemas = Expect<
	DbAfterDrop extends {
		readonly schemas: {
			auth: {
				users: {
					id: string
					email: string
				}
			}
		}
	}
		? true
		: false
>
type _DbAfterDropMigrations = Expect<
	DbAfterDrop extends {
		readonly migrations: {
			"20260409093300_users": string
			"20260409093400_agenda": string
			"20260409093500_alter_agenda": string
			"20260409093600_drop_agenda": string
		}
	}
		? true
		: false
>

type DbAlterMissing = Apply<Apply<Build, UsersImport>, AlterMissingImport>
type _DbAlterMissing = Expect<DbAlterMissing extends SqlParseError<string> ? true : false>

type DbUnsupported = Apply<Build, UnsupportedImport>
type _DbUnsupported = Expect<DbUnsupported extends SqlParseError<string> ? true : false>

type ParsedCreate = SqlMigration<"file:///migrations/parsed_create.ts", `create table users (id int not null, email text not null)`>["parsed"]
type _ParsedCreate = Expect<
	Equal<ParsedCreate["row"], SqlCreateTable<`create table users (id int not null, email text not null)`>["row"]>
>

type ParsedArityError = SqlMigration<"file:///migrations/parsed_arity.ts", `create table t (id int not null, x int, foreign key (x) references users(id, email))`>["parsed"]
type _ParsedArityError = Expect<
	Equal<ParsedArityError, SqlParseError<"Foreign key referenced column list has more entries than the local column list">>
>


type AppliedDropViaSqlApply = SqlApply<
	DbAfterDrop,
	SqlApplyDropTable<readonly ["auth", "users"]>
>
type _AppliedDropViaSqlApply = Expect<
	AppliedDropViaSqlApply extends { readonly kind: "database"; readonly schemas: unknown; readonly migrations: unknown }
		? true
		: false
>

describe("sql migrations", () => {
	it("should run", () => {})
})
