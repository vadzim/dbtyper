import { describe, it } from "node:test"
import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

// --- CREATE TABLE ---

type CreateTable = SqlStatement<InitBuffer<`create table users (id int not null, email text)`>>
type _CreateTable = Expect<
	Matches<
		CreateTable,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["users"]
				readonly row: { id: number; email: string | null }
				readonly refs: undefined
			},
			EmptyBuffer,
		]
	>
>

type CreateTableSemicolon = SqlStatement<InitBuffer<`create table users (id int not null);`>>
type _CreateTableSemicolon = Expect<
	Matches<
		CreateTableSemicolon,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["users"]
				readonly row: { id: number }
				readonly refs: undefined
			},
			EmptyBuffer,
		]
	>
>

type CreateTableSchemaQualified = SqlStatement<
	InitBuffer<`create table auth.sessions (token text not null, user_id int not null)`>
>
type _CreateTableSchemaQualified = Expect<
	Matches<
		CreateTableSchemaQualified,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["sessions", "auth"]
				readonly row: { token: string; user_id: number }
				readonly refs: undefined
			},
			EmptyBuffer,
		]
	>
>

type CreateTableWithArrays = SqlStatement<InitBuffer<`create table t (tags text[], nums int4[] not null)`>>
type _CreateTableWithArrays = Expect<
	Matches<
		CreateTableWithArrays,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["t"]
				readonly row: { tags: string[] | null; nums: number[] }
				readonly refs: undefined
			},
			EmptyBuffer,
		]
	>
>

// --- ALTER TABLE ---

type AlterTableAdd = SqlStatement<InitBuffer<`alter table if exists public.users add column age int`>>
type _AlterTableAdd = Expect<
	Matches<
		AlterTableAdd,
		[
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
			EmptyBuffer,
		]
	>
>

type AlterTableDrop = SqlStatement<InitBuffer<`alter table users drop column if exists email`>>
type _AlterTableDrop = Expect<
	Matches<
		AlterTableDrop,
		[
			{
				readonly kind: "alter_table"
				readonly ifExists: false
				readonly target: readonly ["users"]
				readonly action: {
					readonly kind: "drop_column"
					readonly ifExists: true
					readonly name: "email"
				}
			},
			EmptyBuffer,
		]
	>
>

type AlterTableRename = SqlStatement<InitBuffer<`alter table users rename column age to years`>>
type _AlterTableRename = Expect<
	Matches<
		AlterTableRename,
		[
			{
				readonly kind: "alter_table"
				readonly ifExists: false
				readonly target: readonly ["users"]
				readonly action: {
					readonly kind: "rename_column"
					readonly from: "age"
					readonly to: "years"
				}
			},
			EmptyBuffer,
		]
	>
>

// --- DROP TABLE ---

type DropTable = SqlStatement<InitBuffer<`drop table if exists auth.users`>>
type _DropTable = Expect<
	Matches<
		DropTable,
		[
			{
				readonly kind: "drop_table"
				readonly ifExists: true
				readonly target: readonly ["users", "auth"]
			},
			EmptyBuffer,
		]
	>
>

// --- CREATE SCHEMA ---

type CreateSchema = SqlStatement<InitBuffer<`create schema if not exists billing`>>
type _CreateSchema = Expect<
	Matches<
		CreateSchema,
		[
			{
				readonly kind: "create_schema"
				readonly name: "billing"
				readonly ifNotExists: true
			},
			EmptyBuffer,
		]
	>
>

// --- DROP SCHEMA ---

type DropSchema = SqlStatement<InitBuffer<`drop schema if exists staging`>>
type _DropSchema = Expect<
	Matches<
		DropSchema,
		[
			{
				readonly kind: "drop_schema"
				readonly name: "staging"
				readonly ifExists: true
			},
			EmptyBuffer,
		]
	>
>

// --- Error cases: result is SqlParseError, rest is the original buffer ---

type UnknownStatement = SqlStatement<InitBuffer<`create view v as select 1`>>
type _UnknownStatement = Expect<
	Matches<UnknownStatement, [SqlParseError<"Unknown sql statement">, InitBuffer<`create view v as select 1`>]>
>

type InvalidColumn = SqlStatement<InitBuffer<`create table broken (id)`>>
type _InvalidColumnResult = Expect<Matches<InvalidColumn[0], SqlParseError<"Invalid column definition">>>

type TrailingTokens = SqlStatement<InitBuffer<`drop table users extra`>>
type _TrailingTokens = Expect<Matches<TrailingTokens[0], SqlParseError<"Unable to parse DROP TABLE statement">>>

type InvalidIfNot = SqlStatement<InitBuffer<`create schema if not billing`>>
type _InvalidIfNot = Expect<Matches<InvalidIfNot[0], SqlParseError<"Expected EXISTS after IF NOT">>>

describe("sql statement buffer", () => {
	it("should run", () => {})
})
