import { describe, it } from "node:test"
import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ParseCreate = SqlStatementLoose<`create table users (id int not null, email text)`>
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

type ParseAlter = SqlStatementLoose<`alter table if exists public.users add column age int`>
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

type ParseDrop = SqlStatementLoose<`drop table if exists auth.users;`>
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

type ParseCreateSchema = SqlStatementLoose<`create schema if not exists billing;`>
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

type ParseDropSchema = SqlStatementLoose<`drop schema if exists staging`>
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

type ParseUnknown = SqlStatementLoose<`create view v as select 1`>
type _ParseUnknown = Expect<Matches<ParseUnknown, SqlParseError<"Unknown sql statement">>>

type ParseInvalidCreate = SqlStatementLoose<`create table broken (id)`>
type _ParseInvalidCreate = Expect<Matches<ParseInvalidCreate, SqlParseError<"Invalid column definition">>>

type ParseInvalidKeywordBoundary = SqlStatementLoose<`createx table users (id int)`>
type _ParseInvalidKeywordBoundary = Expect<Matches<ParseInvalidKeywordBoundary, SqlParseError<"Unknown sql statement">>>

type ParseInvalidDropBoundary = SqlStatementLoose<`dropx table users`>
type _ParseInvalidDropBoundary = Expect<Matches<ParseInvalidDropBoundary, SqlParseError<"Unknown sql statement">>>

type ParseInvalidIfNot = SqlStatementLoose<`create schema if not billing`>
type _ParseInvalidIfNot = Expect<Matches<ParseInvalidIfNot, SqlParseError<"Expected EXISTS after IF NOT">>>

type ParseTrailingTokens = SqlStatementLoose<`drop table users extra`>
type _ParseTrailingTokens = Expect<Matches<ParseTrailingTokens, SqlParseError<"Unable to parse DROP TABLE statement">>>

describe("sql parse migration", () => {
	it("should run", () => {})
})
