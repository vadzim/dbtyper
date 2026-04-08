import type { SqlCreateTableToType, SqlParseError } from "./sql.js"
import { describe, it } from "node:test"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

type Users = SqlCreateTableToType<`
	CREATE TABLE users (
		id int not null,
		email varchar(255) not null,
		display_name text,
		is_active boolean not null,
		meta json
	);
`>

type _UsersShape = Expect<
	Equal<
		Users,
		{
			id: number
			email: string
			display_name: string | null
			is_active: boolean
			meta: unknown | null
		}
	>
>

type Posts = SqlCreateTableToType<"create table posts (id bigint not null, rating decimal(10,2), title text)">
type _PostsShape = Expect<
	Equal<
		Posts,
		{
			id: number
			rating: number | null
			title: string | null
		}
	>
>

type Invalid = SqlCreateTableToType<"select * from users">
type _Invalid = Expect<Equal<Invalid, SqlParseError<"Expected a CREATE TABLE statement">>>

type WithConstraints = SqlCreateTableToType<`
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
	Equal<
		WithConstraints,
		{
			id: number
			email: string
			org_id: number | null
		}
	>
>

type BadUniqueRef = SqlCreateTableToType<`
	create table bad_unique (
		id int not null,
		unique (missing_col)
	)
`>
type _BadUniqueRef = Expect<
	Equal<BadUniqueRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type BadForeignKeyRef = SqlCreateTableToType<`
	create table bad_fk (
		id int not null,
		org_id int,
		foreign key (missing_col) references orgs(id)
	)
`>
type _BadForeignKeyRef = Expect<
	Equal<BadForeignKeyRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type WithComments = SqlCreateTableToType<`
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
	Equal<
		WithComments,
		{
			id: number
			email: string
			org_id: number | null
		}
	>
>

type BadRefWithComments = SqlCreateTableToType<`
	create table bad_ref_with_comments (
		id int not null,
		/* wrong column should still fail */
		unique (missing_col)
	)
`>
type _BadRefWithComments = Expect<
	Equal<BadRefWithComments, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type QuotedIdentifiers = SqlCreateTableToType<`
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
	Equal<
		QuotedIdentifiers,
		{
			id: number
			"user name": string | null
			"org-id": number | null
			"is active": boolean
		}
	>
>

type BadQuotedRef = SqlCreateTableToType<`
	create table q_bad (
		"id" int not null,
		unique ("missing id")
	)
`>
type _BadQuotedRef = Expect<
	Equal<BadQuotedRef, SqlParseError<`Unknown column "missing id" referenced in table constraint`>>
>

describe("sql tests", () => {
	it("should run", () => {})
})
