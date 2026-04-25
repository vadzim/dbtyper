/**
 * SqlApplyStatements: ALTER TABLE apply type tests (add/drop/rename column, rename table, IF EXISTS).
 */
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { JsqlGetColumnFactsMap, JsqlGetConstraintMap } from "../src/engine/table-constraint-meta.ts"

type DbApplyAlterFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null)
`>
	>[1]
>

type _DbApplyAlterFixture = Expect<
	Matches<
		DbApplyAlterFixture,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
				}
			}
		}
	>
>

// --- Add column ---

/** Add a new NOT NULL column on an existing table. */

type AddNewColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users add column email text not null`>
	>[1]
>

type _AddNewColumn = Expect<
	Matches<
		AddNewColumn,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number; email: string } }

						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: { tables: { sessions: { columns: { id: string } } } }
			}
		}
	>
>

type AddColumnWithFacts = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema test;
		create table test.users (id int not null);
		alter table test.users add column created_at timestamptz default now() not null
`>
	>[1]
>
type AddColumnWithFactsTable = AddColumnWithFacts extends {
	schemas: { test: { tables: { users: infer T } } }
}
	? T
	: never
type _AddColumnFactsMap = Expect<
	Matches<JsqlGetColumnFactsMap<AddColumnWithFactsTable>, { created_at: { default: true } }>
>
type _AddColumnWithFacts = Expect<
	Matches<
		AddColumnWithFacts,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: {
							columns: {
								id: number
								created_at: Date
							}
							column_facts: { created_at: { default: true } }
						}
					}
				}
			}
		}
	>
>

/** Duplicate column without IF NOT EXISTS is an error. */

type AddExistingColumnNoIfNotExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users add column age int`>
	>[1]
>

type _AddExistingColumnNoIfNotExists = Expect<
	Matches<AddExistingColumnNoIfNotExists, SqlParserError<"Duplicate column name: age">>
>

/** IF NOT EXISTS skips add when the column already exists. */

type AddExistingColumnIfNotExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users add column if not exists age int`>
	>[1]
>

type _AddExistingColumnIfNotExists = Expect<
	Matches<
		AddExistingColumnIfNotExists,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
				}
			}
		}
	>
>

// --- Drop column ---

/** Drop an existing column. */

type DropExistingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users drop column age`>
	>[1]
>

type _DropExistingColumn = Expect<
	Matches<
		DropExistingColumn,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: { tables: { sessions: { columns: { id: string } } } }
			}
		}
	>
>

/** Unknown column without IF EXISTS is an error. */

type DropMissingColumnNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users drop column missing`>
	>[1]
>

type _DropMissingColumnNoIfExists = Expect<
	Matches<DropMissingColumnNoIfExists, SqlParserError<`Unknown column "missing" in altered table`>>
>

/** IF EXISTS makes drop of a missing column a no-op. */

type DropMissingColumnIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users drop column if exists missing`>
	>[1]
>

type _DropMissingColumnIfExists = Expect<
	Matches<
		DropMissingColumnIfExists,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
				}
			}
		}
	>
>

// --- Rename column ---

/** Rename an existing column. */

type RenameExistingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users rename column age to years`>
	>[1]
>

type _RenameExistingColumn = Expect<
	Matches<
		RenameExistingColumn,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; years: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: { tables: { sessions: { columns: { id: string } } } }
			}
		}
	>
>

type RenameColumnWithFacts = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema test;
		create table test.users (id int not null, created_at timestamptz default now() not null);
		alter table test.users rename column created_at to inserted_at
`>
	>[1]
>
type RenameColumnWithFactsTable = RenameColumnWithFacts extends {
	schemas: { test: { tables: { users: infer T } } }
}
	? T
	: never
type _RenameColumnFactsMap = Expect<
	Matches<JsqlGetColumnFactsMap<RenameColumnWithFactsTable>, { inserted_at: { default: true } }>
>
type _RenameColumnWithFacts = Expect<
	Matches<
		RenameColumnWithFacts,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: {
							columns: {
								id: number
								inserted_at: Date
							}
							column_facts: { inserted_at: { default: true } }
						}
					}
				}
			}
		}
	>
>

type DropColumnWithFacts = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema test;
		create table test.users (id int not null, created_at timestamptz default now() not null);
		alter table test.users drop column created_at
`>
	>[1]
>
type DropColumnWithFactsTable = DropColumnWithFacts extends {
	schemas: { test: { tables: { users: infer T } } }
}
	? T
	: never
type _DropColumnFactsMap = Expect<Matches<JsqlGetColumnFactsMap<DropColumnWithFactsTable>, {}>>
type _DropColumnWithFacts = Expect<
	Matches<
		DropColumnWithFacts,
		{
			defaultSchema: "test"
			schemas: { test: { tables: { users: { columns: { id: number } } } } }
		}
	>
>

/** Rename from a missing column is an error. */

type RenameMissingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users rename column missing to years`>
	>[1]
>

type _RenameMissingColumn = Expect<
	Matches<RenameMissingColumn, SqlParserError<`Unknown column "missing" in altered table`>>
>

/** Target name that collides with an existing column is an error. */

type RenameToExistingColumnName = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users rename column age to id`>
	>[1]
>

type _RenameToExistingColumnName = Expect<
	Matches<RenameToExistingColumnName, SqlParserError<"Duplicate column name: id">>
>

// --- Rename table ---

/** Rename a table within its schema. */

type RenameTableOk = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users rename to members`>
	>[1]
>

type _RenameTableOk = Expect<
	Matches<
		RenameTableOk,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						members: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: { tables: { sessions: { columns: { id: string } } } }
			}
		}
	>
>

/** New table name that already exists in the schema is an error. */

type RenameTableDuplicate = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.users rename to posts`>
	>[1]
>

type _RenameTableDuplicate = Expect<Matches<RenameTableDuplicate, SqlParserError<"Duplicate table name: posts">>>

// --- Table resolution ---

/** Alter a missing table without IF EXISTS is an error. */

type AlterMissingNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table test.missing add column age int`>
	>[1]
>

type _AlterMissingNoIfExists = Expect<
	Matches<AlterMissingNoIfExists, SqlParserError<`Unknown altered table "test.missing" in database`>>
>

type AlterMissingSchemeNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	alter table test.missing add column age int
`>
	>[1]
>

type _AlterMissingSchemeNoIfExists = Expect<
	Matches<AlterMissingSchemeNoIfExists, SqlParserError<`Unknown altered table "test.missing" in database`>>
>

type AlterMissingSchemeIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	alter table if exists test.missing add column age int
`>
	>[1]
>

type _AlterMissingSchemeIfExists = Expect<
	Matches<
		AlterMissingSchemeIfExists,
		{
			defaultSchema: "test"
			schemas: {}
		}
	>
>

/** IF EXISTS skips alter when the table is missing. */

type AlterMissingIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table if exists test.missing add column age int`>
	>[1]
>

type _AlterMissingIfExists = Expect<
	Matches<
		AlterMissingIfExists,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
				}
			}
		}
	>
>

/** Unqualified name resolves to default schema; duplicate column is an error. */

type AlterDefaultSchemaUnqualified = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table users add column age int`>
	>[1]
>

type _AlterDefaultSchemaUnqualified = Expect<
	Matches<AlterDefaultSchemaUnqualified, SqlParserError<"Duplicate column name: age">>
>

/** Qualified alter on a non-default schema adds a nullable timestamptz column. */

type AlterExplicitSchemaQualified = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, age int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	alter table auth.sessions add column expires_at timestamptz`>
	>[1]
>

type _AlterExplicitSchemaQualified = Expect<
	Matches<
		AlterExplicitSchemaQualified,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number; age: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string; expires_at: Date | null } }
					}
				}
			}
		}
	>
>

// --- ALTER COLUMN SET / DROP NOT NULL ---

type AlterSetNotNullOnNullable = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.t (label text);
	alter table test.t alter column label set not null
`>
	>[1]
>
type _AlterSetNotNullOnNullable = Expect<
	Matches<
		AlterSetNotNullOnNullable,
		{
			defaultSchema: "test"
			schemas: { test: { tables: { t: { columns: { label: string } } } } }
		}
	>
>

type AlterDropNotNull = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.t (n int not null);
	alter table test.t alter column n drop not null
`>
	>[1]
>
type _AlterDropNotNull = Expect<
	Matches<
		AlterDropNotNull,
		{
			defaultSchema: "test"
			schemas: { test: { tables: { t: { columns: { n: number | null } } } } }
		}
	>
>

// --- ADD / DROP CONSTRAINT metadata ---

type AddUniqueConstraint = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.u (id int not null, email text);
	alter table test.u add constraint u_email_key unique (email)
`>
	>[1]
>
type UAfterAddConstraint = AddUniqueConstraint extends { schemas: { test: { tables: { u: infer T } } } } ? T : never
type _JsqlMapAfterAdd = Expect<
	Matches<JsqlGetConstraintMap<UAfterAddConstraint>, { u_email_key: { kind: "unique"; columns: ["email"] } }>
>
type _AddUniqueConstraint = Expect<
	Matches<
		AddUniqueConstraint,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						u: {
							columns: {
								id: number
								email: string | null
							}
							constraints: { u_email_key: { kind: "unique"; columns: ["email"] } }
						}
					}
				}
			}
		}
	>
>

type AddThenDropStmts = ParseSqlStatements<
	ParseSqlTokens<`
	create schema test;
	create table test.u (id int not null, email text);
	alter table test.u add constraint u_email_key unique (email);
	alter table test.u drop constraint u_email_key
`>
>[1]
type _AddThenDropStmts = Expect<Matches<AddThenDropStmts["length"], 4>>
type AddThenDropConstraint = SqlApplyStatements<SqlDatabase<"test">, AddThenDropStmts>
type DropConstraintOnly = ParseSqlStatements<ParseSqlTokens<`alter table test.u drop constraint u_email_key`>>[1]
type DropOnDbWithConstraint = SqlApplyStatements<AddUniqueConstraint, DropConstraintOnly>
type _DropInIsolation = Expect<
	Matches<
		DropOnDbWithConstraint,
		{
			defaultSchema: "test"
			schemas: { test: { tables: { u: { columns: { id: number; email: string | null } } } } }
		}
	>
>
type _AddThenDropConstraint = Expect<
	Matches<
		AddThenDropConstraint,
		{
			defaultSchema: "test"
			schemas: { test: { tables: { u: { columns: { id: number; email: string | null } } } } }
		}
	>
>

type AddPrimaryNamed = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create table test.u (id int not null);
	alter table test.u add constraint u_pkey primary key (id)
`>
	>[1]
>
type _AddPrimaryNamed = Expect<
	Matches<
		AddPrimaryNamed,
		{
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						u: {
							columns: { id: number }
							constraints: { u_pkey: { kind: "primary_key"; columns: ["id"] } }
						}
					}
				}
			}
		}
	>
>

describe("sql apply alter table", () => {
	it("should run", () => {})
})
