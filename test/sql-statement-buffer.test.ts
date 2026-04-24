import { describe, it } from "node:test"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

// --- CREATE TABLE ---

type CreateTable = ParseSqlStatement<ParseSqlTokens<`create table users (id int not null, email text)`>>
type _CreateTable = Expect<
	Matches<
		CreateTable,
		[
			EmptyTokenList,
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

type CreateTableSemicolon = ParseSqlStatement<ParseSqlTokens<`create table users (id int not null);`>>
type _CreateTableSemicolon = Expect<
	Matches<
		CreateTableSemicolon,
		[
			EmptyTokenList,
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
	ParseSqlTokens<`create table auth.sessions (token text not null, user_id int not null)`>
>
type _CreateTableSchemaQualified = Expect<
	Matches<
		CreateTableSchemaQualified,
		[
			EmptyTokenList,
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

type CreateTableWithArrays = ParseSqlStatement<ParseSqlTokens<`create table t (tags text[], nums int4[] not null)`>>
type _CreateTableWithArrays = Expect<
	Matches<
		CreateTableWithArrays,
		[
			EmptyTokenList,
			{
				kind: "create_table"
				name: ["t"]
				row: {
					tags: string[] | null
					nums: number[]
				}
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

// --- ALTER TABLE ---

type AlterTableAdd = ParseSqlStatement<ParseSqlTokens<`alter table if exists public.users add column age int`>>
type _AlterTableAdd = Expect<
	Matches<
		AlterTableAdd,
		[
			EmptyTokenList,
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

type AlterTableDrop = ParseSqlStatement<ParseSqlTokens<`alter table users drop column if exists email`>>
type _AlterTableDrop = Expect<
	Matches<
		AlterTableDrop,
		[
			EmptyTokenList,
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

type AlterTableRename = ParseSqlStatement<ParseSqlTokens<`alter table users rename column age to years`>>
type _AlterTableRename = Expect<
	Matches<
		AlterTableRename,
		[
			EmptyTokenList,
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

type DropTable = ParseSqlStatement<ParseSqlTokens<`drop table if exists auth.users`>>
type _DropTable = Expect<
	Matches<
		DropTable,
		[
			EmptyTokenList,
			{
				kind: "drop_table"
				ifExists: true
				target: ["users", "auth"]
			},
		]
	>
>

// --- CREATE SCHEMA ---

type CreateSchema = ParseSqlStatement<ParseSqlTokens<`create schema if not exists billing`>>
type _CreateSchema = Expect<
	Matches<
		CreateSchema,
		[
			EmptyTokenList,
			{
				kind: "create_schema"
				name: "billing"
				ifNotExists: true
			},
		]
	>
>

// --- DROP SCHEMA ---

type DropSchema = ParseSqlStatement<ParseSqlTokens<`drop schema if exists staging`>>
type _DropSchema = Expect<
	Matches<
		DropSchema,
		[
			EmptyTokenList,
			{
				kind: "drop_schema"
				name: "staging"
				ifExists: true
			},
		]
	>
>

// --- Error cases: result is SqlParserError, rest is the original buffer ---

type UnknownStatement = ParseSqlStatement<ParseSqlTokens<`create view v as select 1;`>>
type _UnknownStatement = Expect<
	Matches<
		UnknownStatement,
		[
			EmptyTokenList,
			{
				kind: "skipped-statement"
				token: TokenType<";">
			},
		]
	>
>

type InvalidColumn = ParseSqlStatement<ParseSqlTokens<`create table broken (id)`>>
type _InvalidColumnResult = Expect<Matches<InvalidColumn[1], SqlParserError<"Invalid column definition">>>

type TrailingTokens = ParseSqlStatement<ParseSqlTokens<`drop table users extra`>>
type _TrailingTokens = Expect<Matches<TrailingTokens[1], SqlParserError<"Unable to parse DROP TABLE statement">>>

type InvalidIfNot = ParseSqlStatement<ParseSqlTokens<`create schema if not billing`>>
type _InvalidIfNot = Expect<Matches<InvalidIfNot[1], SqlParserError<"Expected EXISTS after IF NOT">>>

describe("sql statement buffer", () => {
	it("should run", () => {})
})
