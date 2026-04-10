import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type Users = SqlStatement<`
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
			readonly name: readonly ["users"]
			readonly row: {
				id: number
				email: string
				display_name: string | null
				is_active: boolean
				meta: unknown | null
			}
			readonly refs: undefined
		}
	>
>

type Posts = SqlStatement<"create table posts (id bigint not null, rating decimal(10,2), title text)">
type _PostsShape = Expect<
	Matches<
		Posts,
		{
			readonly kind: "create_table"
			readonly name: readonly ["posts"]
			readonly row: {
				id: number
				rating: number | null
				title: string | null
			}
			readonly refs: undefined
		}
	>
>

type Invalid = SqlStatement<"select * from users">
type _Invalid = ExpectFalse<Matches<Invalid, { readonly kind: "create_table" }>>

type WithConstraints = SqlStatement<`
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
	WithConstraints extends {
		readonly kind: "create_table"
		readonly name: readonly ["accounts"]
		readonly row: {
			id: number
			email: string
			org_id: number | null
		}
		readonly refs: {
			from: string
			columnPairs: readonly (readonly [string, string])[]
			toSchema: string | undefined
			toTable: string
		}
	}
		? true
		: false
>

type BadUniqueRef = SqlStatement<`
	create table bad_unique (
		id int not null,
		unique (missing_col)
	)
`>
type _BadUniqueRef = Expect<
	Matches<BadUniqueRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type BadForeignKeyRef = SqlStatement<`
	create table bad_fk (
		id int not null,
		org_id int,
		foreign key (missing_col) references orgs(id)
	)
`>
type _BadForeignKeyRef = Expect<
	Matches<BadForeignKeyRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type WithComments = SqlStatement<`
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
	WithComments extends {
		readonly kind: "create_table"
		readonly name: readonly ["commented_users"]
		readonly row: {
			id: number
			email: string
			org_id: number | null
		}
		readonly refs: {
			from: string
			columnPairs: readonly (readonly [string, string])[]
			toSchema: string | undefined
			toTable: string
		}
	}
		? true
		: false
>

type BadRefWithComments = SqlStatement<`
	create table bad_ref_with_comments (
		id int not null,
		/* wrong column should still fail */
		unique (missing_col)
	)
`>
type _BadRefWithComments = Expect<
	Matches<BadRefWithComments, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type QuotedIdentifiers = SqlStatement<`
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
	QuotedIdentifiers extends {
		readonly kind: "create_table"
		readonly name: readonly ["account users"]
		readonly row: {
			id: number
			"user name": string | null
			"org-id": number | null
			"is active": boolean
		}
		readonly refs: {
			from: string
			columnPairs: readonly (readonly [string, string])[]
			toSchema: string | undefined
			toTable: string
		}
	}
		? true
		: false
>

type BadQuotedRef = SqlStatement<`
	create table q_bad (
		"id" int not null,
		unique ("missing id")
	)
`>
type _BadQuotedRef = Expect<
	Matches<BadQuotedRef, SqlParseError<`Unknown column "missing id" referenced in table constraint`>>
>

type _TableNameSimple = Expect<Matches<SqlStatement<"create table users (id int)">["name"], readonly ["users"]>>

type _TableNameQuoted = Expect<
	Matches<SqlStatement<`create table "account users" ("id" int not null)`>["name"], readonly ["account users"]>
>

type PostgresTypes = SqlStatement<`
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
			readonly name: readonly ["pg_types"]
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
			readonly refs: undefined
		}
	>
>
describe("sql create table", () => {
	it("should run", () => {})
})
