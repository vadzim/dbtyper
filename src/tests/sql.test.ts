import type { SqlAlterTable, SqlCreateTable, SqlDropTable, SqlParseError } from "../sql.js"
import { describe, it } from "node:test"
import type { Equal, Expect, Matches } from "./type-test-utils.js"

type Users = SqlCreateTable<`
	CREATE TABLE users (
		id int not null,
		email varchar(255) not null,
		display_name text,
		is_active boolean not null,
		meta json
	);
`>

type _UsersShape = Expect<
	Matches<
		Users,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: "users"
			readonly row: {
				id: number
				email: string
				display_name: string | null
				is_active: boolean
				meta: unknown | null
			}
		}
	>
>

type Posts = SqlCreateTable<"create table posts (id bigint not null, rating decimal(10,2), title text)">
type _PostsShape = Expect<
	Matches<
		Posts,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: "posts"
			readonly row: {
				id: number
				rating: number | null
				title: string | null
			}
		}
	>
>

type Invalid = SqlCreateTable<"select * from users">
type _InvalidName = Expect<Equal<Invalid["name"], SqlParseError<"Expected a CREATE TABLE statement with a table name">>>
type _InvalidRow = Expect<Equal<Invalid["row"], SqlParseError<"Expected a CREATE TABLE statement">>>

type WithConstraints = SqlCreateTable<`
	create table accounts (
		id int not null,
		email text not null,
		org_id int,
		constraint accounts_pk primary key (id),
		unique (email),
		foreign key (org_id) references orgs(id)
	)
`>

type _WithConstraintsShape = Expect<
	Matches<
		WithConstraints,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: "accounts"
			readonly row: {
				id: number
				email: string
				org_id: number | null
			}
		}
	>
>

type BadUniqueRef = SqlCreateTable<`
	create table bad_unique (
		id int not null,
		unique (missing_col)
	)
`>
type _BadUniqueRef = Expect<
	Equal<BadUniqueRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type BadForeignKeyRef = SqlCreateTable<`
	create table bad_fk (
		id int not null,
		org_id int,
		foreign key (missing_col) references orgs(id)
	)
`>
type _BadForeignKeyRef = Expect<
	Equal<BadForeignKeyRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type WithComments = SqlCreateTable<`
	-- one-line comment before statement
	CREATE TABLE commented_users (
		id int not null, -- inline one-line comment
		/* block comment before col */
		email text not null,
		-- email2 text not null,
		/*
			multiline block comment
		*/
		org_id int,
		constraint users_pk primary key (id), -- trailing comment
		/* this should still validate */
		foreign key (org_id) references orgs(id)
	);
`>
type _WithCommentsShape = Expect<
	Matches<
		WithComments,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: "commented_users"
			readonly row: {
				id: number
				email: string
				org_id: number | null
			}
		}
	>
>

type BadRefWithComments = SqlCreateTable<`
	create table bad_ref_with_comments (
		id int not null,
		/* wrong column should still fail */
		unique (missing_col)
	)
`>
type _BadRefWithComments = Expect<
	Equal<BadRefWithComments, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type QuotedIdentifiers = SqlCreateTable<`
	create table "account users" (
		"id" int not null,
		"user name" text,
		\`org-id\` int,
		[is active] boolean not null,
		constraint "users pk" primary key ("id"),
		unique ("user name"),
		foreign key (\`org-id\`) references orgs(id)
	)
`>

type _QuotedIdentifiersShape = Expect<
	Matches<
		QuotedIdentifiers,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: "account users"
			readonly row: {
				id: number
				"user name": string | null
				"org-id": number | null
				"is active": boolean
			}
		}
	>
>

type BadQuotedRef = SqlCreateTable<`
	create table q_bad (
		"id" int not null,
		unique ("missing id")
	)
`>
type _BadQuotedRef = Expect<
	Equal<BadQuotedRef, SqlParseError<`Unknown column "missing id" referenced in table constraint`>>
>

type _TableNameSimple = Expect<Equal<SqlCreateTable<"create table users (id int)">["name"], "users">>

type _TableNameQuoted = Expect<
	Equal<SqlCreateTable<`create table "account users" ("id" int not null)`>["name"], "account users">
>

type PostgresTypes = SqlCreateTable<`
	create table pg_types (
		id serial not null,
		i2 int2 not null,
		i4 int4 not null,
		i8 int8 not null,
		f4 float4,
		f8 float8,
		amount money,
		flag bool not null,
		created_at timestamptz not null,
		alarm_at timetz,
		payload jsonb,
		raw bytea,
		ref uuid,
		host inet,
		r int4range,
		tags text[],
		numbers int4[]
	)
`>
type _PostgresTypes = Expect<
	Matches<
		PostgresTypes,
		{
			readonly kind: "create_table"
			readonly name: "pg_types"
			readonly source: string
			readonly row: {
				id: number
				i2: number
				i4: number
				i8: number
				f4: number | null
				f8: number | null
				amount: number | null
				flag: boolean
				created_at: Date
				alarm_at: Date | null
				payload: unknown | null
				raw: Uint8Array | null
				ref: string | null
				host: string | null
				r: unknown | null
				tags: string[] | null
				numbers: number[] | null
			}
		}
	>
>

type AlterUsers = SqlAlterTable<`alter table public.users add column age int`>
type _AlterUsers = Expect<
	Matches<
		AlterUsers,
		{
			readonly kind: "alter_table"
			readonly target: "public.users"
			readonly action: "add column age int"
			readonly source: string
		}
	>
>

type BadAlter = SqlAlterTable<`alter table public.users`>
type _BadAlter = Expect<Equal<BadAlter, SqlParseError<"Expected an ALTER TABLE action">>>

type DropUsers = SqlDropTable<`drop table if exists public.users`>
type _DropUsers = Expect<
	Matches<
		DropUsers,
		{
			readonly kind: "drop_table"
			readonly target: "public.users"
			readonly ifExists: true
			readonly source: string
		}
	>
>

type BadDrop = SqlDropTable<`drop view public.users`>
type _BadDrop = Expect<Equal<BadDrop, SqlParseError<"Expected a DROP TABLE statement with a table target">>>

describe("sql tests", () => {
	it("should run", () => {})
})
