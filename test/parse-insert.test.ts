import { describe, it } from "node:test"
import type { JsqlInsertStatementResult } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
					column_facts: { id: { not_null: true } }
				}
			}
		}
	}
}

type InsOk = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values ('u1', 'n1');`>,
	DbUsers
>
type _insOk = Expect<Extends<Tuple3At2<InsOk>, JsqlInsertStatementResult>>

type InsParam = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values (:id, :name);`>,
	DbUsers,
	{ id: { ts: string; sql: "uuid" }; name: { ts: string; sql: "text" } }
>
type _insParam = Expect<Extends<Tuple3At2<InsParam>, JsqlInsertStatementResult>>

type InsParamMissing = ParseSqlStatement<ParseSqlTokens<`insert into users (id, name) values (:id, :name);`>, DbUsers>
type _insParamMissing = Expect<Extends<Tuple3At2<InsParamMissing>, SqlParserError<"Unknown query parameter">>>

type InsBadType = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values (1, 'n');`>,
	DbUsers
>
type _insBadType = Expect<Extends<Tuple3At2<InsBadType>, SqlParserError<"Incompatible value type for column">>>

type InsNullNotNull = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, name) values (null, 'n');`>,
	DbUsers
>
type _insNullNotNull = Expect<Extends<Tuple3At2<InsNullNotNull>, SqlParserError<"NULL not allowed for NOT NULL column">>>

type InsUnknownCol = ParseSqlStatement<
	ParseSqlTokens<`insert into users (id, nope) values ('u', 'x');`>,
	DbUsers
>
type _insUnknownCol = Expect<Extends<Tuple3At2<InsUnknownCol>, SqlParserError<"Unknown column in INSERT column list">>>

/** Qualified `public.users` while `defaultSchema` is `app` (must not resolve via default only). */
type DbAppDefaultPublicUsers = {
	defaultSchema: "app"
	schemas: {
		app: { sets: {} }
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
					column_facts: { id: { not_null: true } }
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
type InsTableAlias = ParseSqlStatement<
	ParseSqlTokens<`insert into users u (id, name) values ('a','b');`>,
	DbUsers
>
type _insTableAlias = Expect<Extends<Tuple3At2<InsTableAlias>, JsqlInsertStatementResult>>

type InsQualifiedTableAlias = ParseSqlStatement<
	ParseSqlTokens<`insert into public.users u (id, name) values ('a','b');`>,
	DbAppDefaultPublicUsers
>
type _insQualifiedTableAlias = Expect<Extends<Tuple3At2<InsQualifiedTableAlias>, JsqlInsertStatementResult>>

describe("parse-insert (type tests)", () => {
	it("compile-time assertions above", () => {})
})
