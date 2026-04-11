import { describe, it } from "node:test"
import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { InitBuffer, SqlParseError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

// Copy of sql-statement-buffer.test.ts, but with extra operations appended after ';'
// and the expected Rest changed from EmptyBuffer -> InitBuffer<...>.

// --- CREATE TABLE ---

type CreateTable = SqlStatement<
	InitBuffer<`create table users (id int not null, email text); drop table users`>
>

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
			InitBuffer<`drop table users`>,
		]
	>
>

type CreateTableSemicolon = SqlStatement<
	InitBuffer<`create table users (id int not null); drop schema if exists staging`>
>

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
			InitBuffer<`drop schema if exists staging`>,
		]
	>
>

type CreateTableSchemaQualified = SqlStatement<
	InitBuffer<`create table auth.sessions (token text not null, user_id int not null); alter table auth.sessions add column age int`>
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
			InitBuffer<`alter table auth.sessions add column age int`>,
		]
	>
>

type CreateTableWithArrays = SqlStatement<
	InitBuffer<`create table t (tags text[], nums int4[] not null); create schema if not exists billing`>
>

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
			InitBuffer<`create schema if not exists billing`>,
		]
	>
>

// --- ALTER TABLE ---

type AlterTableAdd = SqlStatement<
	InitBuffer<`alter table if exists public.users add column age int; drop table if exists auth.users`>
>

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
			InitBuffer<`drop table if exists auth.users`>,
		]
	>
>

type AlterTableDrop = SqlStatement<
	InitBuffer<`alter table users drop column if exists email; create table users (id int not null)`>
>

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
			InitBuffer<`create table users (id int not null)`>,
		]
	>
>

type AlterTableRename = SqlStatement<
	InitBuffer<`alter table users rename column age to years; drop schema if exists staging`>
>

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
			InitBuffer<`drop schema if exists staging`>,
		]
	>
>

// --- DROP TABLE ---

type DropTable = SqlStatement<
	InitBuffer<`drop table if exists auth.users; create schema if not exists billing`>
>

type _DropTable = Expect<
	Matches<
		DropTable,
		[
			{
				readonly kind: "drop_table"
				readonly ifExists: true
				readonly target: readonly ["users", "auth"]
			},
			InitBuffer<`create schema if not exists billing`>,
		]
	>
>

// --- CREATE SCHEMA ---

type CreateSchema = SqlStatement<
	InitBuffer<`create schema if not exists billing; drop schema if exists billing`>
>

type _CreateSchema = Expect<
	Matches<
		CreateSchema,
		[
			{
				readonly kind: "create_schema"
				readonly name: "billing"
				readonly ifNotExists: true
			},
			InitBuffer<`drop schema if exists billing`>,
		]
	>
>

// --- DROP SCHEMA ---

type DropSchema = SqlStatement<
	InitBuffer<`drop schema if exists staging; create schema if not exists staging`>
>

type _DropSchema = Expect<
	Matches<
		DropSchema,
		[
			{
				readonly kind: "drop_schema"
				readonly name: "staging"
				readonly ifExists: true
			},
			InitBuffer<`create schema if not exists staging`>,
		]
	>
>

// --- Error cases: keep as-is ---

type UnknownStatement = SqlStatement<InitBuffer<`create view v as select 1`>>
type _UnknownStatement = Expect<
	Matches<UnknownStatement, [SqlParseError<"Unknown sql statement">, InitBuffer<`create view v as select 1`>]>
>

describe("sql statement buffer (non-empty rest)", () => {
	it("should run", () => {})
})
