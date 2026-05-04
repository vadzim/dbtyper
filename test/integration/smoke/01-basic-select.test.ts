// Integration smoke test: Basic SELECT queries
// Стыль: type-level tests як у parse-select.test.ts

import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../../../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../../../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple3At2 } from "../../test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../../../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../../../src/core/sql-database.ts"
import type { JsqlSelectStatementResult } from "../../../src/core/jsql-shapes.ts"

// Тэставая БД з міграцыямі
type TestDb = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create schema auth;
create table users ( id text not null, name text not null, email text );
create table auth.orders ( id text not null, user_id text not null, total numeric );
`
>[0]

// ✅ ПОСПЕХ: SELECT named columns
type TSelectColumns = ParseSqlStatement<ParseSqlTokens<`select id, name from users;`>, TestDb>
type _selectColumns = Expect<Extends<Tuple3At2<TSelectColumns>, JsqlSelectStatementResult>>

// ✅ ПОСПЕХ: SELECT *
type TSelectStar = ParseSqlStatement<ParseSqlTokens<`select * from users;`>, TestDb>
type _selectStar = Expect<Extends<Tuple3At2<TSelectStar>, JsqlSelectStatementResult>>

// ✅ ПОСПЕХ: SELECT з WHERE
type TSelectWhere = ParseSqlStatement<ParseSqlTokens<`select id from users where name = 'test';`>, TestDb>
type _selectWhere = Expect<Extends<Tuple3At2<TSelectWhere>, JsqlSelectStatementResult>>

// ✅ ПОСПЕХ: SELECT з qualified table name
type TSelectQualified = ParseSqlStatement<ParseSqlTokens<`select id, total from auth.orders;`>, TestDb>
type _selectQualified = Expect<Extends<Tuple3At2<TSelectQualified>, JsqlSelectStatementResult>>

// ❌ ПАМЫЛКА: няправільная калонка
type TBadColumn = ParseSqlStatement<ParseSqlTokens<`select wrong_col from users;`>, TestDb>
type _badColumn = Expect<Extends<Tuple3At2<TBadColumn>, SqlParserError<string>>>

// ❌ ПАМЫЛКА: няправільная калонка ў WHERE
type TBadWhere = ParseSqlStatement<ParseSqlTokens<`select id from users where wrong_col = 'x';`>, TestDb>
type _badWhere = Expect<Extends<Tuple3At2<TBadWhere>, SqlParserError<string>>>

describe("Integration smoke: Basic SELECT", () => {
	it("compile-time type assertions above", () => {
		// Усе тэсты выкананы на ўзроўні тыпаў
		// Калі файл кампілюецца — усё ОК
	})
})
