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

type ParseUnknown = SqlStatements<InitBuffer<`create view v as select 1`>>
type _ParseUnknown = Expect<
	Matches<ParseUnknown, [SqlParseError<"Unknown sql statement">, InitBuffer<`create view v as select 1`>]>
>

type ParseInvalidCreate = SqlStatements<InitBuffer<`create table broken (id)`>>
type _ParseInvalidCreate = Expect<
	Matches<ParseInvalidCreate, [SqlParseError<"Invalid column definition">, InitBuffer<`create table broken (id)`>]>
>

type ParseInvalidKeywordBoundary = SqlStatements<InitBuffer<`createx table users (id int)`>>
type _ParseInvalidKeywordBoundary = Expect<
	Matches<
		ParseInvalidKeywordBoundary,
		[SqlParseError<"Unknown sql statement">, InitBuffer<`createx table users (id int)`>]
	>
>

type ParseInvalidDropBoundary = SqlStatements<InitBuffer<`dropx table users`>>
type _ParseInvalidDropBoundary = Expect<
	Matches<ParseInvalidDropBoundary, [SqlParseError<"Unknown sql statement">, InitBuffer<`dropx table users`>]>
>

type ParseInvalidIfNot = SqlStatements<InitBuffer<`create schema if not billing`>>
type _ParseInvalidIfNot = Expect<
	Matches<
		ParseInvalidIfNot,
		[SqlParseError<"Expected EXISTS after IF NOT">, InitBuffer<`create schema if not billing`>]
	>
>

type ParseTrailingTokens = SqlStatements<InitBuffer<`drop table users extra`>>
type _ParseTrailingTokens = Expect<
	Matches<
		ParseTrailingTokens,
		[SqlParseError<"Unable to parse DROP TABLE statement">, InitBuffer<`drop table users extra`>]
	>
>

describe("sql parse migration", () => {
	it("should run", () => {})
})
