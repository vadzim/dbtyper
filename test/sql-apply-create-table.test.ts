/**
 * SqlApplyStatements: CREATE TABLE apply type tests (schemas, FKs, duplicates, parse errors).
 */
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type {
	JsqlGetColumnFactsMap,
	JsqlGetConstraintMap,
	JsqlTableColumnFactsKey,
	JsqlTableConstraintsKey,
} from "../src/engine/table-constraint-meta.ts"

type DbApplyCreateTableFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
	>[1]
>

type _DbApplyCreateTableFixture = Expect<
	Matches<
		DbApplyCreateTableFixture,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { id: number; email: string }
				}
				auth: {}
			}
		}
	>
>

type CreateWithNamedConstraints = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.accounts (
		id int not null,
		email text not null,
		constraint accounts_pk primary key (id),
		constraint accounts_email_key unique (email)
	)
`>
	>[1]
>
type AccountsNamed = CreateWithNamedConstraints extends { schemas: { test: { accounts: infer A } } } ? A : never
type _AccountsConstraintMap = Expect<
	Matches<
		JsqlGetConstraintMap<AccountsNamed>,
		{
			accounts_pk: { kind: "primary_key"; columns: ["id"] }
			accounts_email_key: { kind: "unique"; columns: ["email"] }
		}
	>
>
type _CreateWithNamedConstraints = Expect<
	Matches<
		CreateWithNamedConstraints,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					accounts: {
						id: number
						email: string
					} & {
						[J in JsqlTableConstraintsKey]: {
							accounts_pk: { kind: "primary_key"; columns: ["id"] }
							accounts_email_key: { kind: "unique"; columns: ["email"] }
						}
					}
				}
			}
		}
	>
>

type CreateWithColumnFacts = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.column_facts (
		id int default 1 not null,
		label text default 'hello',
		score int check (score > 0),
		total int generated always as (id + score) stored
	)
`>
	>[1]
>
type ColumnFactsRow = CreateWithColumnFacts extends { schemas: { test: { column_facts: infer R } } } ? R : never
type _ColumnFactsMap = Expect<
	Matches<
		JsqlGetColumnFactsMap<ColumnFactsRow>,
		{
			id: { default: true }
			label: { default: true }
			score: { check: true }
			total: { generated: { mode: "stored" } }
		}
	>
>
type _CreateWithColumnFacts = Expect<
	Matches<
		CreateWithColumnFacts,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					column_facts: {
						id: number
						label: string | null
						score: number | null
						total: number | null
					} & {
						[J in JsqlTableColumnFactsKey]: {
							id: { default: true }
							label: { default: true }
							score: { check: true }
							total: { generated: { mode: "stored" } }
						}
					}
				}
			}
		}
	>
>

type MixedCaseColumns = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema test;
		create table users ("Id" int not null, Id int not null, "Main\x20\x20\x20Title" text not null)
`>
	>[1]
>

type _MixedCaseColumns = Expect<
	Matches<
		MixedCaseColumns,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { Id: number; id: number; "Main\x20\x20\x20Title": string }
				}
			}
		}
	>
>

// --- Create table (default and explicit schema) ---

/** New table in the default schema. */

type CreateInDefaultSchema = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null)
`>
	>[1]
>

type _CreateInDefaultSchema = Expect<
	Matches<
		CreateInDefaultSchema,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

/** New table in a qualified non-default schema. */

type CreateInExplicitSchema = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table auth.sessions (id uuid not null)
`>
	>[1]
>

type _CreateInExplicitSchema = Expect<
	Matches<
		CreateInExplicitSchema,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { id: number; email: string }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

// --- Duplicates and missing schema ---

/** Duplicate table name in the same schema is an error. */

type CreateDuplicateTable = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table users (id int not null)
`>
	>[1]
>

type _CreateDuplicateTable = Expect<Matches<CreateDuplicateTable, SqlParserError<"Duplicate table name: users">>>

/** Creating a table when the default schema does not exist yet is an error. */

type CreateTableWithoutSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<ParseSqlTokens<`create table users (id int not null)`>>[1]
>

type _CreateTableWithoutSchema = Expect<
	Matches<CreateTableWithoutSchema, SqlParserError<`Unknown schema "public" (use CREATE SCHEMA first)`>>
>

// --- Parse and FK validation errors ---

type CreateInvalidRowStatement = {
	kind: "create_table"
	name: ["broken"]
	row: SqlParserError<"bad row">
	source: "create table broken (id)"
	refs: undefined
	intraTableConstraints: []
}

/** Row parse error on create_table is propagated. */

type CreateInvalidRow = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		...ParseSqlStatements<
			ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
		>[1],
		CreateInvalidRowStatement,
	]
>

type _CreateInvalidRow = Expect<Matches<CreateInvalidRow, SqlParserError<"bad row">>>

/** Valid foreign key referencing default-schema users. */

type CreateWithForeignKeyOk = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table posts (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
	>[1]
>

type _CreateWithForeignKeyOk = Expect<
	Matches<
		CreateWithForeignKeyOk,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

type CreateWithForeignKeyBadLocalStatement = {
	kind: "create_table"
	name: ["posts_bad"]
	row: { id: number; user_id: number }
	source: "create table posts_bad (...)"
	refs: {
		from: ""
		columnPairs: [["missing_col", "id"]]
		toSchema: undefined
		toTable: "users"
	}
	intraTableConstraints: []
}

/** FK referencing a non-existent local column is an error. */

type CreateWithForeignKeyBadLocal = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		...ParseSqlStatements<
			ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
		>[1],
		CreateWithForeignKeyBadLocalStatement,
	]
>

type _CreateWithForeignKeyBadLocal = Expect<
	Matches<CreateWithForeignKeyBadLocal, SqlParserError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** Composite foreign key with matching arity. */

type CreateWithCompositeForeignKeyOk = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table pair_refs (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id, u_email) references users(id, email)
	)
`>
	>[1]
>

type _CreateWithCompositeForeignKeyOk = Expect<
	Matches<
		CreateWithCompositeForeignKeyOk,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					users: { id: number; email: string }
					pair_refs: { id: number; u_id: number; u_email: string }
				}
				auth: {}
			}
		}
	>
>

type CreateWithCompositeForeignKeyBadArity = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table pair_arity_bad (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id) references users(id, email)
	)
`>
	>[1]
>

/** Mismatched local vs referenced column counts is an error. */

type _CreateWithCompositeForeignKeyBadArity = Expect<
	Matches<
		CreateWithCompositeForeignKeyBadArity,
		SqlParserError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql apply create table", () => {
	it("should run", () => {})
})
