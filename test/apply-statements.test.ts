import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Matches, Tuple2At1, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ApplyParsedStatements, ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** `public` with one table so **`CREATE VIEW … AS SELECT`** can resolve `FROM`. */
type DbDefaultPublic = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				t: {
					kind: "table"
					columns: { id: number }
					column_sql_types: { id: "integer" }
				}
			}
		}
	}
}

type ApplyCreateThenSelect = ApplyStatements<DbDefaultPublic, `create table s ( id int not null ); select id from s;`>

type _applyMergedTable = Expect<
	Extends<ApplyCreateThenSelect["schemas"]["public"]["sets"]["s"], { kind: "table"; columns: { id: number } }>
>

/** First statement errors → **`ApplyParsedStatements`** returns **`[Rest, Db]`** and does not apply the second `CREATE`. */
type ApplyStopOnFirstError = ApplyParsedStatements<
	ParseSqlTokens<`create table ghost.m ( id int not null ); create table t ( id int not null );`>,
	DbDefaultPublic
>
type _applyStopDb = Expect<Matches<Tuple2At1<ApplyStopOnFirstError>, DbDefaultPublic>>

type TCreateView = ParseSqlStatement<ParseSqlTokens<`create view v as select t.id from t;`>, DbDefaultPublic>
type _createViewMerged = Expect<Extends<Tuple3At2<TCreateView>, null>>
type _createViewDb = Expect<Extends<TCreateView[1]["schemas"]["public"]["sets"]["v"], { kind: "view" }>>

type TGrantSkip = ParseSqlStatement<ParseSqlTokens<`grant select on public.t to anon;`>, DbDefaultPublic>
type _grantSkipped = Expect<Extends<Tuple3At2<TGrantSkip>, { kind: "skipped-statement" }>>
type _grantDb = Expect<Matches<TGrantSkip[1], DbDefaultPublic>>

/** `ApplyStatements` returns the input DB unchanged when it is already a parse error (no script walk). */
type ApplyErrInputDb = ApplyStatements<SqlParserError<"bad">, `create schema s;`>
type _applyErrInputDb = Expect<Extends<ApplyErrInputDb, SqlParserError<"bad">>>

describe("apply-statements (type tests)", () => {
	it("compile-time assertions above", () => {})
})
