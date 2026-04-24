import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens } from "../core/sql-tokens.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type Users = ParseSqlStatements<
	ParseSqlTokens<`
	CREATE TABLE users (
		id int not null,
		email varchar(255) not null,
		display_name text,
		is_active boolean not null,
		meta json
	);
`>
>

type _UsersShape = Expect<
	Matches<
		Users,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["users"]
					row: {
						id: number
						email: string
						display_name: string | null
						is_active: boolean
						meta: unknown | null
					}
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>

type Posts = ParseSqlStatements<
	ParseSqlTokens<"create table posts (id bigint not null, rating decimal(10,2), title text)">
>
type _PostsShape = Expect<
	Matches<
		Posts,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["posts"]
					row: {
						id: number
						rating: number | null
						title: string | null
					}
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>

type Invalid = ParseSqlStatements<ParseSqlTokens<"select * from users;">>
type _Invalid = Expect<
	Matches<
		Invalid,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
		]
	>
>

type WithConstraints = ParseSqlStatements<
	ParseSqlTokens<`
	create table accounts (
		id int not null,
		email text not null,
		org_id int,
		constraint accounts_pk primary key (id),
		unique (email),
		foreign key (org_id) references orgs(id)
	)
`>
>

type _WithConstraintsShape = Expect<
	Matches<
		WithConstraints,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["accounts"]
					row: { email: string; id: number; org_id: number | null }
					refs: {
						from: ""
						columnPairs: [["org_id", "id"]]
						toSchema: undefined
						toTable: "orgs"
					}
					intraTableConstraints: [
						{ kind: "primary_key"; columns: ["id"] },
						{ kind: "unique"; columns: ["email"] },
					]
				},
			],
		]
	>
>

type BadUniqueRef = ParseSqlStatements<
	ParseSqlTokens<`
	create table bad_unique (
		id int not null,
		unique (missing_col)
	)
`>
>
type _BadUniqueRef = Expect<
	Matches<
		BadUniqueRef,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["bad_unique"]
					row: { id: number }
					refs: undefined
					intraTableConstraints: [{ kind: "unique"; columns: ["missing_col"] }]
				},
			],
		]
	>
>

type BadForeignKeyRef = ParseSqlStatements<
	ParseSqlTokens<`
	create table bad_fk (
		id int not null,
		org_id int,
		foreign key (missing_col) references orgs(id)
	)
`>
>
type _BadForeignKeyRef = Expect<
	Matches<
		BadForeignKeyRef,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["bad_fk"]
					row: { org_id: number | null; id: number }
					refs: {
						from: ""
						columnPairs: [["missing_col", "id"]]
						toSchema: undefined
						toTable: "orgs"
					}
					intraTableConstraints: []
				},
			],
		]
	>
>

type WithComments = ParseSqlStatements<
	ParseSqlTokens<`
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
>
type _WithCommentsShape = Expect<
	Matches<
		WithComments,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["commented_users"]
					row: { email: string; id: number; org_id: number | null }
					refs: {
						from: ""
						columnPairs: [["org_id", "id"]]
						toSchema: undefined
						toTable: "orgs"
					}
					intraTableConstraints: [{ kind: "primary_key"; columns: ["id"] }]
				},
			],
		]
	>
>

type BadRefWithComments = ParseSqlStatements<
	ParseSqlTokens<`
	create table bad_ref_with_comments (
		id int not null,
		/* wrong column should still fail */
		unique (missing_col)
	)
`>
>
type _BadRefWithComments = Expect<
	Matches<
		BadRefWithComments,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["bad_ref_with_comments"]
					row: { id: number }
					refs: undefined
					intraTableConstraints: [{ kind: "unique"; columns: ["missing_col"] }]
				},
			],
		]
	>
>

type QuotedIdentifiers = ParseSqlStatements<
	ParseSqlTokens<`
	create table "account users" (
		"id" int not null,
		"user name" text,
		\`org-id\` int,
		constraint "users pk" primary key ("id"),
		unique ("user name"),
		foreign key (\`org-id\`) references orgs(id)
	)
`>
>

type _QuotedIdentifiersShape = Expect<
	Matches<
		QuotedIdentifiers,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["account users"]
					row: { id: number; "org-id": number | null; "user name": string | null }
					refs: {
						from: ""
						columnPairs: [["org-id", "id"]]
						toSchema: undefined
						toTable: "orgs"
					}
					intraTableConstraints: [
						{ kind: "primary_key"; columns: ["id"] },
						{ kind: "unique"; columns: ["user name"] },
					]
				},
			],
		]
	>
>

type BadQuotedRef = ParseSqlStatements<
	ParseSqlTokens<`
	create table q_bad (
		"id" int not null,
		unique ("missing id")
	)
`>
>
type _BadQuotedRef = Expect<
	Matches<
		BadQuotedRef,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["q_bad"]
					row: { id: number }
					refs: undefined
					intraTableConstraints: [{ kind: "unique"; columns: ["missing id"] }]
				},
			],
		]
	>
>

type _TableNameSimple = Expect<
	Matches<ParseSqlStatements<ParseSqlTokens<"create table users (id int)">>[1][0]["name"], ["users"]>
>

type _TableNameQuoted = Expect<
	Matches<
		ParseSqlStatements<ParseSqlTokens<`create table "account users" ("id" int not null)`>>[1][0]["name"],
		["account users"]
	>
>

type PostgresTypes = ParseSqlStatements<
	ParseSqlTokens<`
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
>
type _PostgresTypes = Expect<
	Matches<
		PostgresTypes,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["pg_types"]
					row: {
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
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>
// Type names are identifiers — they can appear in double quotes in SQL and
// behave identically to the unquoted form.

type QuotedTypeNames = ParseSqlStatements<
	ParseSqlTokens<`
	create table quoted_types (
		a "int" not null,
		b "text",
		c "uuid" not null,
		d "timestamp" not null,
		e "timetz",
		f "inet",
		g "int4range"
	)
`>
>
type _QuotedTypeNames = Expect<
	Matches<
		QuotedTypeNames,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["quoted_types"]
					row: {
						a: number
						b: string | null
						c: string
						d: Date
						e: Date | null
						f: string | null
						g: unknown | null
					}
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>

// Type names can also be used as column names (they are just identifiers).
type TypeNamesAsColumnNames = ParseSqlStatements<
	ParseSqlTokens<`
	create table type_name_columns (
		int int not null,
		text text,
		uuid uuid not null,
		timestamp timestamp not null,
		inet inet
	)
`>
>
type _TypeNamesAsColumnNames = Expect<
	Matches<
		TypeNamesAsColumnNames,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["type_name_columns"]
					row: {
						int: number
						text: string | null
						uuid: string
						timestamp: Date
						inet: string | null
					}
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>

describe("sql create table", () => {
	it("should run", () => {})
})
