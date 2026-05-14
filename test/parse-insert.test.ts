import { describe, it } from "node:test"
import type { JsqlDatabaseShape, JsqlInsertStatementResult } from "../src/core/jsql-shapes.ts"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { TText } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ApplyStatements } from "../src/parser/parse-sql-statement.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type InsOk = ParseSqlStatement<CreateParserMonad<`insert into users (id, name) values ('u1', 'n1');`>, DbUsers>
type _insOk = Expect<Extends<InsOk[2], JsqlInsertStatementResult>>

type InsParam = ParseSqlStatement<
	CreateParserMonad<`insert into users (id, name) values (:id, :name);`>,
	DbUsers,
	{ id: TText; name: TText }
>
type _insParam = Expect<Extends<InsParam[2], JsqlInsertStatementResult>>

/** Qualified `public.users` while `defaultSchema` is `app` (must not resolve via default only). */
type DbAppDefaultPublicUsers = {
	defaultSchema: "app"
	schemas: {
		app: { sets: unknown }
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type InsQualified = ParseSqlStatement<
	CreateParserMonad<`insert into public.users (id, name) values ('a','b');`>,
	DbAppDefaultPublicUsers
>

type _insQualified = Expect<Extends<InsQualified[2], JsqlInsertStatementResult>>

/** Table alias before `(` column list (scope for `VALUES` is still the base table). */
type InsTableAlias = ParseSqlStatement<CreateParserMonad<`insert into users u (id, name) values ('a','b');`>, DbUsers>

type _insTableAlias = Expect<Extends<InsTableAlias[2], JsqlInsertStatementResult>>

type InsQualifiedTableAlias = ParseSqlStatement<
	CreateParserMonad<`insert into public.users u (id, name) values ('a','b');`>,
	DbAppDefaultPublicUsers
>

type _insQualifiedTableAlias = Expect<Extends<InsQualifiedTableAlias[2], JsqlInsertStatementResult>>

/** Multi-row `VALUES` — each row checked against the column list. */
type InsMultiRow = ParseSqlStatement<
	CreateParserMonad<`insert into users (id, name) values ('u1','n1'), ('u2','n2');`>,
	DbUsers
>

type _insMultiRow = Expect<Extends<InsMultiRow[2], JsqlInsertStatementResult>>

type InsReturning = ParseSqlStatement<
	CreateParserMonad<`insert into users (id, name) values ('u1','n1') returning id, name;`>,
	DbUsers
>

type InsReturningRes = InsReturning[2]
type _insReturning = Expect<Extends<InsReturningRes, JsqlInsertStatementResult>>
type _insReturningProj = Expect<Extends<InsReturningRes["returning"], { id: TText; name: TText }>>

type InsUpsert = ParseSqlStatement<
	CreateParserMonad<`insert into users (id, name) values ('u1','n1') on conflict (id) do update set name = excluded.name;`>,
	DbUsers
>
type InsUpsertRes = InsUpsert[2]
type _insUpsert = Expect<Extends<InsUpsertRes, JsqlInsertStatementResult>>
type _insUpsertSetCols = Expect<Extends<InsUpsertRes["on_conflict_update_set_columns"], readonly string[]>>

type InsUpsertWhereReturning = ParseSqlStatement<
	CreateParserMonad<`insert into users (id, name) values ('u1','n1') on conflict (id) do update set name = excluded.name where excluded.id = users.id returning users.id;`>,
	DbUsers
>
type InsUpsertWhereReturningRes = InsUpsertWhereReturning[2]
type _insUpsertWhereReturning = Expect<Extends<InsUpsertWhereReturningRes, JsqlInsertStatementResult>>
type _insUpsertWhereReturningId = Expect<Extends<InsUpsertWhereReturningRes["returning"], { id: TText }>>

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
