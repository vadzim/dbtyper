import type {
	SqlCreateTable,
	SqlDatabase,
	SqlParseError,
} from "./sql.js"
import { describe, it } from "node:test"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T
type Matches<Actual, Expected> = Actual extends Expected ? true : false

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
type _Invalid = Expect<
	Matches<
		Invalid,
		{
			readonly kind: "create_table"
			readonly source: string
			readonly name: SqlParseError<"Expected a CREATE TABLE statement with a table name">
			readonly row: SqlParseError<"Expected a CREATE TABLE statement">
		}
	>
>

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
	Equal<
		BadUniqueRef["row"],
		SqlParseError<`Unknown column "missing_col" referenced in table constraint`>
	>
>

type BadForeignKeyRef = SqlCreateTable<`
	create table bad_fk (
		id int not null,
		org_id int,
		foreign key (missing_col) references orgs(id)
	)
`>
type _BadForeignKeyRef = Expect<
	Equal<
		BadForeignKeyRef["row"],
		SqlParseError<`Unknown column "missing_col" referenced in table constraint`>
	>
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
	Equal<
		BadRefWithComments["row"],
		SqlParseError<`Unknown column "missing_col" referenced in table constraint`>
	>
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
	Equal<
		BadQuotedRef["row"],
		SqlParseError<`Unknown column "missing id" referenced in table constraint`>
	>
>

type _TableNameSimple = Expect<
	Equal<SqlCreateTable<"create table users (id int)">["name"], "users">
>

type _TableNameQuoted = Expect<
	Equal<
		SqlCreateTable<`create table "account users" ("id" int not null)`>["name"],
		"account users"
	>
>

type UsersTable = SqlCreateTable<`
	create table users (
		id int not null,
		email text not null
	)
`>

type PostsTable = SqlCreateTable<`
	create table posts (
		id int not null,
		user_id int not null,
		title text
	)
`>

type DbFromTableTypes = SqlDatabase<[UsersTable, PostsTable]>
type _DbFromTableTypes = Expect<
	Equal<
		DbFromTableTypes,
		{
			users: {
				id: number
				email: string
			}
			posts: {
				id: number
				user_id: number
				title: string | null
			}
		}
	>
>

type DupUsersTableA = SqlCreateTable<"create table users (id int not null)">
type DupUsersTableB = SqlCreateTable<`create table "users" (other_id int not null)`>
type DbDuplicateTables = SqlDatabase<[DupUsersTableA, DupUsersTableB]>
type _DbDuplicateTables = Expect<
	Equal<DbDuplicateTables, SqlParseError<"Duplicate table name: users">>
>

type InvalidTable = SqlCreateTable<"select * from users">
type DbWithInvalidTable = SqlDatabase<[UsersTable, InvalidTable]>
type _DbWithInvalidTable = Expect<
	Equal<DbWithInvalidTable, SqlParseError<"Expected a CREATE TABLE statement with a table name">>
>

describe("sql tests", () => {
	it("should run", () => {})
})
