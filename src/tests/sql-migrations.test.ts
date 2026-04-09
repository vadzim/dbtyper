import { describe, it } from "node:test"
import type { SqlParseError } from "../sql-parse-error.js"
import type { SqlMigration, SqlMigrationsResult } from "../sql.js"
import type { Equal, Expect, Matches } from "./type-test-utils.js"

type UsersMig = {
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
}

type AgendaMig = {
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
}

type AlterAgendaMig = {
	default: SqlMigration<"file:///migrations/20260409093500_alter_agenda.ts", `alter table public.agenda add column meeting_id uuid`>
}

type DropAgendaMig = {
	default: SqlMigration<"file:///migrations/20260409093600_drop_agenda.ts", `drop table public.agenda`>
}

type DbAfterDrop = SqlMigrationsResult<[
	Promise<UsersMig>,
	Promise<AgendaMig>,
	Promise<AlterAgendaMig>,
	Promise<DropAgendaMig>,
]>

type _DbAfterDropShape = Expect<
	Matches<
		DbAfterDrop,
		{
			readonly kind: "database"
			readonly schemas: {
				auth: {
					users: {
						id: string
						email: string
					}
				}
			}
			readonly migrations: Record<string, string>
		}
	>
>

type AlterUnknownMig = {
	default: SqlMigration<"file:///migrations/20260409093700_alter_missing.ts", `alter table public.missing add column x int`>
}

type DbAlterMissing = SqlMigrationsResult<[Promise<UsersMig>, Promise<AlterUnknownMig>]>
type _DbAlterMissing = Expect<
	Equal<DbAlterMissing, SqlParseError<`Unknown altered table "public.missing" in database`>>
>

type UnsupportedMig = {
	default: SqlMigration<"file:///migrations/20260409093800_bad.ts", `create view public.v as select 1`>
}

type DbUnsupported = SqlMigrationsResult<[Promise<UnsupportedMig>]>
type _DbUnsupported = Expect<
	Equal<DbUnsupported, SqlParseError<"Only CREATE TABLE / ALTER TABLE / DROP TABLE migrations are supported for now">>
>

describe("sql migrations", () => {
	it("should run", () => {})
})
