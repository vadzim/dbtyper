import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Matches, Tuple2At1, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ApplyParsedStatements, ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** Same shape as **`test/parse-create-table.test.ts`** — `public` exists for `CREATE TABLE`. */
type DbDefaultPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

type ApplyCreateThenSelect = ApplyStatements<DbDefaultPublic, `create table t ( id int not null ); select id from t;`>

type _applyMergedTable = Expect<
	Extends<ApplyCreateThenSelect["schemas"]["public"]["sets"]["t"], { kind: "table"; columns: { id: number } }>
>

/** First statement errors → **`ApplyParsedStatements`** returns **`[Rest, Db]`** and does not apply the second `CREATE`. */
type ApplyStopOnFirstError = ApplyParsedStatements<
	ParseSqlTokens<`create table ghost.m ( id int not null ); create table t ( id int not null );`>,
	DbDefaultPublic
>
type _applyStopDb = Expect<Matches<Tuple2At1<ApplyStopOnFirstError>, DbDefaultPublic>>

type TCreateViewSkip = ParseSqlStatement<ParseSqlTokens<`create view v as select 1;`>, DbDefaultPublic>
type _createViewSkipped = Expect<Extends<Tuple3At2<TCreateViewSkip>, { kind: "skipped-statement" }>>
type _createViewDb = Expect<Matches<TCreateViewSkip[1], DbDefaultPublic>>

type TGrantSkip = ParseSqlStatement<ParseSqlTokens<`grant select on public.t to anon;`>, DbDefaultPublic>
type _grantSkipped = Expect<Extends<Tuple3At2<TGrantSkip>, { kind: "skipped-statement" }>>
type _grantDb = Expect<Matches<TGrantSkip[1], DbDefaultPublic>>

/** `ApplyStatements` returns the input DB unchanged when it is already a parse error (no script walk). */
type ApplyErrInputDb = ApplyStatements<SqlParserError<"bad">, `create schema s;`>
type _applyErrInputDb = Expect<Extends<ApplyErrInputDb, SqlParserError<"bad">>>

describe("apply-statements (type tests)", () => {
	it("compile-time assertions above", () => {})
})
