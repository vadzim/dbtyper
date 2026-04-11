import { describe, it } from "node:test"
import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ParseCreate = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type ParseAlter = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type ParseDrop = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type ParseCreateSchema = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type ParseDropSchema = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type ParseUnknown = SqlStatements<InitBuffer<`create view v as select 1`>>[0]
type _ParseUnknown = Expect<Matches<ParseUnknown, SqlParseError<"Unknown sql statement">>>

type ParseInvalidCreate = SqlStatements<InitBuffer<`create table broken (id)`>>[0]
type _ParseInvalidCreate = Expect<Matches<ParseInvalidCreate, SqlParseError<"Invalid column definition">>>

type ParseInvalidKeywordBoundary = SqlStatements<InitBuffer<`createx table users (id int)`>>[0]
type _ParseInvalidKeywordBoundary = Expect<Matches<ParseInvalidKeywordBoundary, SqlParseError<"Unknown sql statement">>>

type ParseInvalidDropBoundary = SqlStatements<InitBuffer<`dropx table users`>>[0]
type _ParseInvalidDropBoundary = Expect<Matches<ParseInvalidDropBoundary, SqlParseError<"Unknown sql statement">>>

type ParseInvalidIfNot = SqlStatements<InitBuffer<`create schema if not billing`>>[0]
type _ParseInvalidIfNot = Expect<Matches<ParseInvalidIfNot, SqlParseError<"Expected EXISTS after IF NOT">>>

type ParseTrailingTokens = SqlStatements<InitBuffer<`drop table users extra`>>[0]
type _ParseTrailingTokens = Expect<Matches<ParseTrailingTokens, SqlParseError<"Unable to parse DROP TABLE statement">>>

describe("sql parse migration", () => {
	it("should run", () => {})
})
