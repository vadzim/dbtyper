import { describe, it } from "node:test"
import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ParseCreate = SqlStatements<
	ParseSqlTokens<`
	create table users (id int not null, email text)
`>
>
type _ParseCreate = Expect<
	Matches<
		ParseCreate,
		[
			readonly [
				{
					readonly kind: "create_table"
					readonly name: readonly ["users"]
					readonly row: { id: number; email: string | null }
					readonly refs: undefined
				},
			],
			EmptyTokenList,
		]
	>
>

type ParseAlter = SqlStatements<
	ParseSqlTokens<`
	alter table if exists public.users add column age int
`>
>
type _ParseAlter = Expect<
	Matches<
		ParseAlter,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: true
					readonly target: readonly ["users", "public"]
					readonly action: {
						readonly kind: "add_column"
						readonly ifNotExists: false
						readonly name: "age"
						readonly definition: number | null
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type ParseDrop = SqlStatements<
	ParseSqlTokens<`
	drop table if exists auth.users;
`>
>
type _ParseDrop = Expect<
	Matches<
		ParseDrop,
		[
			readonly [
				{
					readonly kind: "drop_table"
					readonly ifExists: true
					readonly target: readonly ["users", "auth"]
				},
			],
			EmptyTokenList,
		]
	>
>

type ParseCreateSchema = SqlStatements<
	ParseSqlTokens<`
	create schema if not exists billing;
`>
>
type _ParseCreateSchema = Expect<
	Matches<
		ParseCreateSchema,
		[
			readonly [
				{
					readonly kind: "create_schema"
					readonly name: "billing"
					readonly ifNotExists: true
				},
			],
			EmptyTokenList,
		]
	>
>

type ParseDropSchema = SqlStatements<
	ParseSqlTokens<`
	drop schema if exists staging
`>
>
type _ParseDropSchema = Expect<
	Matches<
		ParseDropSchema,
		[
			readonly [
				{
					readonly kind: "drop_schema"
					readonly name: "staging"
					readonly ifExists: true
				},
			],
			EmptyTokenList,
		]
	>
>

type ParseUnknown = SqlStatements<ParseSqlTokens<`create view v as select 1;`>>
type _ParseUnknown = Expect<Matches<ParseUnknown, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>>

type ParseInvalidCreate = SqlStatements<ParseSqlTokens<`create table broken (id)`>>
type _ParseInvalidCreate = Expect<
	Matches<
		ParseInvalidCreate,
		[SqlParserError<"Invalid column definition">, ParseSqlTokens<`create table broken (id)`>]
	>
>

type ParseInvalidKeywordBoundary = SqlStatements<ParseSqlTokens<`createx table users (id int);`>>
type _ParseInvalidKeywordBoundary = Expect<
	Matches<ParseInvalidKeywordBoundary, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type ParseInvalidDropBoundary = SqlStatements<ParseSqlTokens<`dropx table users;`>>
type _ParseInvalidDropBoundary = Expect<
	Matches<ParseInvalidDropBoundary, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type ParseInvalidIfNot = SqlStatements<ParseSqlTokens<`create schema if not billing`>>
type _ParseInvalidIfNot = Expect<
	Matches<
		ParseInvalidIfNot,
		[SqlParserError<"Expected EXISTS after IF NOT">, ParseSqlTokens<`create schema if not billing`>]
	>
>

type ParseTrailingTokens = SqlStatements<ParseSqlTokens<`drop table users extra`>>
type _ParseTrailingTokens = Expect<
	Matches<
		ParseTrailingTokens,
		[SqlParserError<"Unable to parse DROP TABLE statement">, ParseSqlTokens<`drop table users extra`>]
	>
>

describe("sql parse migration", () => {
	it("should run", () => {})
})
