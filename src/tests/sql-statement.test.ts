import { describe, it } from "node:test"
import type { SqlStatement } from "../parser/sql-statement.js"
import type { SqlParseError } from "../sql.js"
import type { Equal, Expect, Matches } from "./type-test-utils.js"

type ParseCreate = SqlStatement<`create table users (id int not null, email text)`>
type _ParseCreate = Expect<
	Matches<
		ParseCreate,
		{
			readonly kind: "create_table"
			readonly name: readonly ["users"]
			readonly row: { id: number; email: string | null }
			readonly source: string
		}
	>
>

type ParseAlter = SqlStatement<`alter table if exists public.users add column age int`>
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
			readonly source: string
		}
	>
>

type ParseDrop = SqlStatement<`drop table if exists auth.users;`>
type _ParseDrop = Expect<
	Matches<
		ParseDrop,
		{
			readonly kind: "drop_table"
			readonly ifExists: true
			readonly target: readonly ["users", "auth"]
			readonly source: string
		}
	>
>

type ParseUnknown = SqlStatement<`create view v as select 1`>
type _ParseUnknown = Expect<Equal<ParseUnknown, SqlParseError<"Unknown sql statement">>>

type ParseInvalidCreate = SqlStatement<`create table broken (id)`>
type _ParseInvalidCreate = Expect<Equal<ParseInvalidCreate, SqlParseError<"Invalid column definition: id">>>

describe("sql parse migration", () => {
	it("should run", () => {})
})
