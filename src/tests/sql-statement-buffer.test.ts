import { describe, it } from "node:test"
import type { ParseSqlStatement } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SkippedStatement } from "../parser/skip-statement.js"

// --- CREATE TABLE ---

type CreateTable = ParseSqlStatement<ParseSqlTokens<`create table users (id int not null, email text)`>>
type _CreateTable = Expect<
	Matches<
		CreateTable,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["users"]
				readonly row: { id: number; email: string | null }
				readonly refs: undefined
				readonly intraTableConstraints: readonly []
			},
			EmptyTokenList,
		]
	>
>

type CreateTableSemicolon = ParseSqlStatement<ParseSqlTokens<`create table users (id int not null);`>>
type _CreateTableSemicolon = Expect<
	Matches<
		CreateTableSemicolon,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["users"]
				readonly row: { id: number }
				readonly refs: undefined
				readonly intraTableConstraints: readonly []
			},
			EmptyTokenList,
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
			{
				readonly kind: "create_table"
				readonly name: readonly ["sessions", "auth"]
				readonly row: { token: string; user_id: number }
				readonly refs: undefined
				readonly intraTableConstraints: readonly []
			},
			EmptyTokenList,
		]
	>
>

type CreateTableWithArrays = ParseSqlStatement<ParseSqlTokens<`create table t (tags text[], nums int4[] not null)`>>
type _CreateTableWithArrays = Expect<
	Matches<
		CreateTableWithArrays,
		[
			{
				readonly kind: "create_table"
				readonly name: readonly ["t"]
				readonly row: { tags: string[] | null; nums: number[] }
				readonly refs: undefined
				readonly intraTableConstraints: readonly []
			},
			EmptyTokenList,
		]
	>
>

// --- ALTER TABLE ---

type AlterTableAdd = ParseSqlStatement<ParseSqlTokens<`alter table if exists public.users add column age int`>>
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
			EmptyTokenList,
		]
	>
>

type AlterTableDrop = ParseSqlStatement<ParseSqlTokens<`alter table users drop column if exists email`>>
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
			EmptyTokenList,
		]
	>
>

type AlterTableRename = ParseSqlStatement<ParseSqlTokens<`alter table users rename column age to years`>>
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
			EmptyTokenList,
		]
	>
>

// --- DROP TABLE ---

type DropTable = ParseSqlStatement<ParseSqlTokens<`drop table if exists auth.users`>>
type _DropTable = Expect<
	Matches<
		DropTable,
		[
			{
				readonly kind: "drop_table"
				readonly ifExists: true
				readonly target: readonly ["users", "auth"]
			},
			EmptyTokenList,
		]
	>
>

// --- CREATE SCHEMA ---

type CreateSchema = ParseSqlStatement<ParseSqlTokens<`create schema if not exists billing`>>
type _CreateSchema = Expect<
	Matches<
		CreateSchema,
		[
			{
				readonly kind: "create_schema"
				readonly name: "billing"
				readonly ifNotExists: true
			},
			EmptyTokenList,
		]
	>
>

// --- DROP SCHEMA ---

type DropSchema = ParseSqlStatement<ParseSqlTokens<`drop schema if exists staging`>>
type _DropSchema = Expect<
	Matches<
		DropSchema,
		[
			{
				readonly kind: "drop_schema"
				readonly name: "staging"
				readonly ifExists: true
			},
			EmptyTokenList,
		]
	>
>

// --- Error cases: result is SqlParserError, rest is the original buffer ---

type UnknownStatement = ParseSqlStatement<ParseSqlTokens<`create view v as select 1;`>>
type _UnknownStatement = Expect<
	Matches<
		UnknownStatement,
		[
			{
				kind: "skipped-statement"
				token: ";"
			},
			EmptyTokenList,
		]
	>
>

type InvalidColumn = ParseSqlStatement<ParseSqlTokens<`create table broken (id)`>>
type _InvalidColumnResult = Expect<Matches<InvalidColumn[0], SqlParserError<"Invalid column definition">>>

type TrailingTokens = ParseSqlStatement<ParseSqlTokens<`drop table users extra`>>
type _TrailingTokens = Expect<Matches<TrailingTokens[0], SqlParserError<"Unable to parse DROP TABLE statement">>>

type InvalidIfNot = ParseSqlStatement<ParseSqlTokens<`create schema if not billing`>>
type _InvalidIfNot = Expect<Matches<InvalidIfNot[0], SqlParserError<"Expected EXISTS after IF NOT">>>

describe("sql statement buffer", () => {
	it("should run", () => {})
})
