import { describe, it } from "node:test"
import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ParseCreate = SqlStatements<InitBuffer<`create table users (id int not null, email text)`>>[0][0]
type _ParseCreate = Expect<
	Matches<
		ParseCreate,
		{
			readonly kind: "create_table"
			readonly name: readonly ["users"]
			readonly row: { id: number; email: string | null }
			readonly refs: undefined
		}
	>
>

type ParseAlter = SqlStatements<InitBuffer<`alter table if exists public.users add column age int`>>[0][0]
type _ParseAlter = Expect<
	Matches<
		ParseAlter,
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
		}
	>
>

type ParseDrop = SqlStatements<InitBuffer<`drop table if exists auth.users;`>>[0][0]
type _ParseDrop = Expect<
	Matches<
		ParseDrop,
		{
			readonly kind: "drop_table"
			readonly ifExists: true
			readonly target: readonly ["users", "auth"]
		}
	>
>

type ParseCreateSchema = SqlStatements<InitBuffer<`create schema if not exists billing;`>>[0][0]
type _ParseCreateSchema = Expect<
	Matches<
		ParseCreateSchema,
		{
			readonly kind: "create_schema"
			readonly name: "billing"
			readonly ifNotExists: true
		}
	>
>

type ParseDropSchema = SqlStatements<InitBuffer<`drop schema if exists staging`>>[0][0]
type _ParseDropSchema = Expect<
	Matches<
		ParseDropSchema,
		{
			readonly kind: "drop_schema"
			readonly name: "staging"
			readonly ifExists: true
		}
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
