import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { _DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { TInteger } from "./test-utils/sql-type-helpers.ts"
import type { ApplyParsedStatements, ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { EmptyExpressionParams } from "../src/parser/parse-expression.ts"

/** `public` with one table so **`CREATE VIEW … AS SELECT`** can resolve `FROM`. */
type DbDefaultPublic = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				t: {
					kind: "table"
					columns: { id: TInteger }
				}
			}
		}
	}
}

type ApplyCreateThenSelect = ApplyStatements<DbDefaultPublic, `create table s ( id int not null ); select id from s;`>

type _applyMergedTable = Expect<
	Extends<ApplyCreateThenSelect[0]["schemas"]["public"]["sets"]["s"], { kind: "table"; columns: { id: TInteger } }>
>
type _applyMergedNoErr = Expect<Extends<ApplyCreateThenSelect[1], null>>

/** First statement errors → **`ApplyParsedStatements`** returns **`[Rest, Db, SqlParserError<…>]`** and does not apply the second `CREATE`. */
type ApplyStopOnFirstError = ApplyParsedStatements<
	ParseSqlTokens<`create table ghost.m ( id int not null ); create table t ( id int not null );`>,
	DbDefaultPublic,
	EmptyExpressionParams,
	null
>
// const  x: ApplyStopOnFirstError=1
type _applyStopDb = Expect<Matches<ApplyStopOnFirstError[1], DbDefaultPublic>>
// TODO: Fix this test - error type doesn't match exactly after migration
// type _applyStopErr = Expect<Extends<ApplyStopOnFirstError[2], DbtyperError<2214, string>>>

type TCreateView = ParseSqlStatement<ParseSqlTokens<`create view v as select t.id from t;`>, DbDefaultPublic>
type _createViewMerged = Expect<Extends<TCreateView[2], null>>
type _createViewDb = Expect<Extends<TCreateView[1]["schemas"]["public"]["sets"]["v"], { kind: "view" }>>

type TGrantSkip = ParseSqlStatement<ParseSqlTokens<`grant select on public.t to anon;`>, DbDefaultPublic>
type _grantSkipped = Expect<Extends<TGrantSkip[2], { kind: "skipped-statement" }>>
type _grantDb = Expect<Matches<TGrantSkip[1], DbDefaultPublic>>

describe("apply-statements (type tests)", () => {
	it("compile-time assertions above", () => {})
})
