import { describe, test } from "node:test"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlDatabase } from "../src/core/sql-database.ts"

// Test database with tables that can shadow each other
type DbShadowing = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create table users (id text, name text);
create table posts (id text, user_id text);
`
>[0]

describe("scope shadowing (type tests)", () => {
	test("compile-time assertions above", () => {
		// CTE shadows table with same name
		type CteShadowsTable = ParseSqlStatement<
			ParseSqlTokens<`
				with users as (select id from posts)
				select id from users;
			`>,
			DbShadowing
		>
		// Just verify it parses without error - the actual column type will be from posts.id
		type _cteShadowsTable = Expect<Extends<CteShadowsTable[2], { kind: "select" }>>

		// Table alias shadows table name - posts now refers to users table
		type AliasShadowsTable = ParseSqlStatement<
			ParseSqlTokens<`
				select posts.id from users as posts;
			`>,
			DbShadowing
		>
		// posts.id should resolve to users.id because posts is an alias for users
		type _aliasShadowsTable = Expect<Extends<AliasShadowsTable[2], { kind: "select" }>>

		// JOIN does not shadow - both tables visible
		type JoinDoesNotShadow = ParseSqlStatement<
			ParseSqlTokens<`
				select users.id, posts.id from users join posts on users.id = posts.user_id;
			`>,
			DbShadowing
		>
		type _joinDoesNotShadow = Expect<Extends<JoinDoesNotShadow[2], { kind: "select" }>>
	})
})
