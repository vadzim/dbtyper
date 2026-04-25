import { describe, it } from "node:test"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenKey } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type ParseCreate = ParseSqlStatements<
	ParseSqlTokens<`
	create table users (id int not null, email text)
`>
>
type _ParseCreate = Expect<
	Matches<
		ParseCreate,
		[
			EmptyTokenList,
			[
				{
					kind: "create_table"
					name: ["users"]
					row: { id: number; email: string | null }
					refs: undefined
					intraTableConstraints: []
				},
			],
		]
	>
>

type ParseAlter = ParseSqlStatements<
	ParseSqlTokens<`
	alter table if exists public.users add column age int
`>
>
type _ParseAlter = Expect<
	Matches<
		ParseAlter,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: true
					target: ["users", "public"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "age"
						definition: number | null
					}
				},
			],
		]
	>
>

type ParseDrop = ParseSqlStatements<
	ParseSqlTokens<`
	drop table if exists auth.users;
`>
>
type _ParseDrop = Expect<
	Matches<
		ParseDrop,
		[
			EmptyTokenList,
			[
				{
					kind: "drop_table"
					ifExists: true
					target: ["users", "auth"]
				},
			],
		]
	>
>

type ParseCreateSchema = ParseSqlStatements<
	ParseSqlTokens<`
	create schema if not exists billing;
`>
>
type _ParseCreateSchema = Expect<
	Matches<
		ParseCreateSchema,
		[
			EmptyTokenList,
			[
				{
					kind: "create_schema"
					name: "billing"
					ifNotExists: true
				},
			],
		]
	>
>

type ParseDropSchema = ParseSqlStatements<
	ParseSqlTokens<`
	drop schema if exists staging
`>
>
type _ParseDropSchema = Expect<
	Matches<
		ParseDropSchema,
		[
			EmptyTokenList,
			[
				{
					kind: "drop_schema"
					name: "staging"
					ifExists: true
				},
			],
		]
	>
>

type ParseUnknown = ParseSqlStatements<ParseSqlTokens<`create view v as select 1;`>>
type _ParseUnknown = Expect<
	Matches<
		ParseUnknown,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenKey<";">
				},
			],
		]
	>
>

type ParseInvalidCreate = ParseSqlStatements<ParseSqlTokens<`create table broken (id)`>>
type _ParseInvalidCreate = Expect<Matches<ParseInvalidCreate[1], SqlParserError<"Invalid column definition">>>

type ParseInvalidKeywordBoundary = ParseSqlStatements<ParseSqlTokens<`createx table users (id int);`>>
type _ParseInvalidKeywordBoundary = Expect<
	Matches<
		ParseInvalidKeywordBoundary,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenKey<";">
				},
			],
		]
	>
>

type ParseInvalidDropBoundary = ParseSqlStatements<ParseSqlTokens<`dropx table users;`>>
type _ParseInvalidDropBoundary = Expect<
	Matches<
		ParseInvalidDropBoundary,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenKey<";">
				},
			],
		]
	>
>

type ParseInvalidIfNot = ParseSqlStatements<ParseSqlTokens<`create schema if not billing`>>
type _ParseInvalidIfNot = Expect<Matches<ParseInvalidIfNot[1], SqlParserError<"Expected EXISTS after IF NOT">>>

type ParseTrailingTokens = ParseSqlStatements<ParseSqlTokens<`drop table users extra`>>
type _ParseTrailingTokens = Expect<
	Matches<ParseTrailingTokens[1], SqlParserError<"Unable to parse DROP TABLE statement">>
>

describe("sql parse migration", () => {
	it("should run", () => {})
})
