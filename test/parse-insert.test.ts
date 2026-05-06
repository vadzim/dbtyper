import { describe, it } from "node:test"
import type { JsqlDatabaseShape, JsqlInsertStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ApplyStatements } from "../src/parser/parse-sql-statement.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: "text"; name: "text" }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type InsOk = ParseSqlStatement<ParseSqlTokens<`insert into users (id, name) values ('u1', 'n1');`>, DbUsers>
type _insOk = Expect<Extends<Tuple3At2<InsOk>, JsqlInsertStatementResult>>

type InsParam = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values (:id, :name);`>,
	DbUsers,
	{ id: { ts: string; sql: "text" }; name: { ts: string; sql: "text" } }
>
type _insParam = Expect<Extends<Tuple3At2<InsParam>, JsqlInsertStatementResult>>

type InsParamMissing = ParseSqlStatement<ParseSqlTokens<`insert into users (id, name) values (:id, :name);`>, DbUsers>
type _insParamMissing = Expect<Extends<Tuple3At2<InsParamMissing>, SqlParserError<"Unknown query parameter">>>

type InsBadType = ParseSqlStatement<ParseSqlTokens<`insert into users (id, name) values (1, 'n');`>, DbUsers>
type _insBadType = Expect<Extends<Tuple3At2<InsBadType>, SqlParserError<"Incompatible value type for column">>>

type InsNullNotNull = ParseSqlStatement<ParseSqlTokens<`insert into users (id, name) values (null, 'n');`>, DbUsers>
type _insNullNotNull = Expect<
	Extends<Tuple3At2<InsNullNotNull>, SqlParserError<"NULL not allowed for NOT NULL column">>
>

type InsUnknownCol = ParseSqlStatement<ParseSqlTokens<`insert into users (id, nope) values ('u', 'x');`>, DbUsers>
type _insUnknownCol = Expect<Extends<Tuple3At2<InsUnknownCol>, SqlParserError<"Unknown column in INSERT column list">>>

type InsMissingNotNull = ParseSqlStatement<ParseSqlTokens<`insert into users (name) values ('n1');`>, DbUsers>
type _insMissingNotNull = Expect<
	Extends<Tuple3At2<InsMissingNotNull>, SqlParserError<"Missing NOT NULL column in INSERT">>
>

/** Qualified `public.users` while `defaultSchema` is `app` (must not resolve via default only). */
type DbAppDefaultPublicUsers = {
	defaultSchema: "app"
	schemas: {
		app: { sets: unknown }
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: "text"; name: "text" }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type InsQualified = ParseSqlStatement<
	ParseSqlTokens<`insert into public.users (id, name) values ('a','b');`>,
	DbAppDefaultPublicUsers
>
type _insQualified = Expect<Extends<Tuple3At2<InsQualified>, JsqlInsertStatementResult>>

/** Table alias before `(` column list (scope for `VALUES` is still the base table). */
type InsTableAlias = ParseSqlStatement<ParseSqlTokens<`insert into users u (id, name) values ('a','b');`>, DbUsers>
type _insTableAlias = Expect<Extends<Tuple3At2<InsTableAlias>, JsqlInsertStatementResult>>

type InsQualifiedTableAlias = ParseSqlStatement<
	ParseSqlTokens<`insert into public.users u (id, name) values ('a','b');`>,
	DbAppDefaultPublicUsers
>
type _insQualifiedTableAlias = Expect<Extends<Tuple3At2<InsQualifiedTableAlias>, JsqlInsertStatementResult>>

/** Multi-row `VALUES` — each row checked against the column list. */
type InsMultiRow = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1','n1'), ('u2','n2');`>,
	DbUsers
>
type _insMultiRow = Expect<Extends<Tuple3At2<InsMultiRow>, JsqlInsertStatementResult>>

/** Second row missing a value → arity / comma error. */
type InsMultiRowArity = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1','n1'), ('u2');`>,
	DbUsers
>
type _insMultiRowArity = Expect<
	Extends<Tuple3At2<InsMultiRowArity>, SqlParserError<"Expected `,` between INSERT values">>
>

type InsReturning = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1','n1') returning id, name;`>,
	DbUsers
>
type InsReturningRes = Tuple3At2<InsReturning>
type _insReturning = Expect<Extends<InsReturningRes, JsqlInsertStatementResult>>
type _insReturningProj = Expect<Extends<InsReturningRes["returning"]["columns"], { id: "text"; name: "text" }>>

type InsUpsert = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1','n1') on conflict (id) do update set name = excluded.name;`>,
	DbUsers
>
type InsUpsertRes = Tuple3At2<InsUpsert>
type _insUpsert = Expect<Extends<InsUpsertRes, JsqlInsertStatementResult>>
type _insUpsertSetCols = Expect<Extends<InsUpsertRes["on_conflict_update_set_columns"], readonly string[]>>

type InsUpsertWhereReturning = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1','n1') on conflict (id) do update set name = excluded.name where excluded.id = users.id returning users.id;`>,
	DbUsers
>
type InsUpsertWhereReturningRes = Tuple3At2<InsUpsertWhereReturning>
type _insUpsertWhereReturning = Expect<Extends<InsUpsertWhereReturningRes, JsqlInsertStatementResult>>
type _insUpsertWhereReturningId = Expect<Extends<InsUpsertWhereReturningRes["returning"]["columns"], { id: "text" }>>

type SeedDb0 = {
	defaultSchema: "public"
	schemas: unknown
}

type SeedDb1 = ApplyStatements<
	SeedDb0,
	`
  create schema if not exists auth;
  create schema if not exists public;
`
>[0]

type SeedDb2 = ApplyStatements<
	SeedDb1,
	`
  create table if not exists auth.users (
    id uuid not null,
    email text not null,
    display_name text,
    login_count integer not null,
    created_at timestamp with time zone null,
    updated_at timestamp with time zone null,
    deleted_at timestamp with time zone null,
    constraint users_pkey primary key (id)
  );
`
>[0]

type SeedDb3 = ApplyStatements<
	SeedDb2,
	`
  create table if not exists public.agenda (
    id uuid not null,
    created_at timestamp with time zone not null,
    user_id uuid not null,
    title text not null,
    agenda text
  );
`
>[0]

type SeedUsers = ApplyStatements<
	SeedDb3,
	`
  insert into auth.users (id, email, display_name, login_count)
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@example.com', 'Alice', 0),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@example.com', 'Bob', 0);
`
>
type _seedUsersDbStillOk = Expect<Extends<SeedUsers[0], JsqlDatabaseShape>>
type _seedUsersNoError = Expect<Matches<SeedUsers[1], null>>

type SeedUsersOneRowNoCast = ApplyStatements<
	SeedDb3,
	`
  insert into auth.users (id, email, display_name, login_count)
  values
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice', 0);
`
>
type _seedUsersOneRowNoCast = Expect<
	Extends<SeedUsersOneRowNoCast[1], SqlParserError<"Incompatible value type for column">>
>

type SeedUsersOneRowCast = ApplyStatements<
	SeedDb3,
	`
  insert into auth.users (id, email, display_name, login_count)
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@example.com', 'Alice', 0);
`
>
type _seedUsersOneRowCast = Expect<Matches<SeedUsersOneRowCast[1], null>>

describe("parse-insert (type tests)", () => {
	it("compile-time assertions above", () => {})
})
