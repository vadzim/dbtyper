import { describe, it } from "node:test"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

// Copy of sql-statement-buffer.test.ts, but with extra operations appended after ';'
// and the expected Rest changed from EmptyBuffer -> InitBuffer<...>.

// --- CREATE TABLE ---

type CreateTable = ParseSqlStatement<
	ParseSqlTokens<`create table users (id int not null, email text); drop table users`>
>

type _CreateTable = Expect<
	Matches<
		CreateTable,
		[
			ParseSqlTokens<`drop table users`>,
			{
				kind: "create_table"
				name: ["users"]
				row: { id: number; email: string | null }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

type CreateTableSemicolon = ParseSqlStatement<
	ParseSqlTokens<`create table users (id int not null); drop schema if exists staging`>
>

type _CreateTableSemicolon = Expect<
	Matches<
		CreateTableSemicolon,
		[
			ParseSqlTokens<`drop schema if exists staging`>,
			{
				kind: "create_table"
				name: ["users"]
				row: { id: number }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

type CreateTableSchemaQualified = ParseSqlStatement<
	ParseSqlTokens<`create table auth.sessions (token text not null, user_id int not null); alter table auth.sessions add column age int`>
>

type _CreateTableSchemaQualified = Expect<
	Matches<
		CreateTableSchemaQualified,
		[
			ParseSqlTokens<`alter table auth.sessions add column age int`>,
			{
				kind: "create_table"
				name: ["sessions", "auth"]
				row: { token: string; user_id: number }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

type CreateTableWithArrays = ParseSqlStatement<
	ParseSqlTokens<`create table t (tags text[], nums int4[] not null); create schema if not exists billing`>
>

type _CreateTableWithArrays = Expect<
	Matches<
		CreateTableWithArrays,
		[
			ParseSqlTokens<`create schema if not exists billing`>,
			{
				kind: "create_table"
				name: ["t"]
				row: { tags: string[] | null; nums: number[] }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

// --- ALTER TABLE ---

type AlterTableAdd = ParseSqlStatement<
	ParseSqlTokens<`alter table if exists public.users add column age int; drop table if exists auth.users`>
>

type _AlterTableAdd = Expect<
	Matches<
		AlterTableAdd,
		[
			ParseSqlTokens<`drop table if exists auth.users`>,
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
		]
	>
>

type AlterTableDrop = ParseSqlStatement<
	ParseSqlTokens<`alter table users drop column if exists email; create table users (id int not null)`>
>

type _AlterTableDrop = Expect<
	Matches<
		AlterTableDrop,
		[
			ParseSqlTokens<`create table users (id int not null)`>,
			{
				kind: "alter_table"
				ifExists: false
				target: ["users"]
				action: {
					kind: "drop_column"
					ifExists: true
					name: "email"
				}
			},
		]
	>
>

type AlterTableRename = ParseSqlStatement<
	ParseSqlTokens<`alter table users rename column age to years; drop schema if exists staging`>
>

type _AlterTableRename = Expect<
	Matches<
		AlterTableRename,
		[
			ParseSqlTokens<`drop schema if exists staging`>,
			{
				kind: "alter_table"
				ifExists: false
				target: ["users"]
				action: {
					kind: "rename_column"
					from: "age"
					to: "years"
				}
			},
		]
	>
>

// --- DROP TABLE ---

type DropTable = ParseSqlStatement<
	ParseSqlTokens<`drop table if exists auth.users; create schema if not exists billing`>
>

type _DropTable = Expect<
	Matches<
		DropTable,
		[
			ParseSqlTokens<`create schema if not exists billing`>,
			{
				kind: "drop_table"
				ifExists: true
				target: ["users", "auth"]
			},
		]
	>
>

// --- CREATE SCHEMA ---

type CreateSchema = ParseSqlStatement<
	ParseSqlTokens<`create schema if not exists billing; drop schema if exists billing`>
>

type _CreateSchema = Expect<
	Matches<
		CreateSchema,
		[
			ParseSqlTokens<`drop schema if exists billing`>,
			{
				kind: "create_schema"
				name: "billing"
				ifNotExists: true
			},
		]
	>
>

// --- DROP SCHEMA ---

type DropSchema = ParseSqlStatement<
	ParseSqlTokens<`drop schema if exists staging; create schema if not exists staging`>
>

type _DropSchema = Expect<
	Matches<
		DropSchema,
		[
			ParseSqlTokens<`create schema if not exists staging`>,
			{
				kind: "drop_schema"
				name: "staging"
				ifExists: true
			},
		]
	>
>

// --- Error cases: keep as-is ---

type UnknownStatement = ParseSqlStatement<ParseSqlTokens<`create view v as select 1;`>>
type _UnknownStatement = Expect<
	Matches<
		UnknownStatement,
		[
			EmptyTokenList,
			{
				kind: "skipped-statement"
				token: TokenType<"key", ";">
			},
		]
	>
>

describe("sql statement buffer (non-empty rest)", () => {
	it("should run", () => {})
})
