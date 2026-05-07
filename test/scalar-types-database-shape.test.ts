import { describe, it } from "node:test"
import type { JsqlSchemaShape, JsqlDataShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TBigint,
	TBoolean,
	TNumeric,
	TUuid,
	TTimestamp,
	TDate,
	TNull,
} from "./test-utils/sql-type-helpers.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbPublicEmpty = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

type CreatedTable = ParseSqlStatement<
	ParseSqlTokens<`create table odd_cols ( id uuid not null, body text not null, flag int not null );`>,
	DbPublicEmpty
>
type OddTable = CreatedTable[1] extends { schemas: { public: { sets: { odd_cols: infer T } } } } ? T : never
type _oddColsFromScalarMap = Expect<
	Extends<
		OddTable,
		{
			kind: "table"
			columns: { id: TUuid; body: TText; flag: TInteger }
			column_facts: {
				id: { nullability: "not_null" }
				body: { nullability: "not_null" }
				flag: { nullability: "not_null" }
			}
		}
	>
>

type DbTiny = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}
type ExoticTable = ParseSqlStatement<
	ParseSqlTokens<`create table exotic ( id uuid not null, payload citext not null );`>,
	DbTiny
>
type ExoticCols = ExoticTable[1] extends { schemas: { public: { sets: { exotic: { columns: infer C } } } } } ? C : never
type _unmappedSqlTypeIsUnknown = Expect<Extends<ExoticCols extends { payload: infer P } ? P : never, unknown>>

type DbOneTable = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				gone: {
					kind: "table"
					columns: { x: TInteger }
				}
			}
		}
	}
}
type DropTable = ParseSqlStatement<ParseSqlTokens<`drop table gone;`>, DbOneTable>
type _dropTableSucceeded = Expect<Extends<DropTable[2], null>>

type DbTwoSchemas = {
	defaultSchema: "public"
	schemas: {
		public: { sets: unknown }
		spare: { sets: unknown }
	}
}
type DropSchema = ParseSqlStatement<ParseSqlTokens<`drop schema spare;`>, DbTwoSchemas>
type _dropSchemaSucceeded = Expect<Extends<DropSchema[2], null>>

type DbOneColTable = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				t: {
					kind: "table"
					columns: { id: TUuid }
				}
			}
		}
	}
}
type AlterAdd = ParseSqlStatement<ParseSqlTokens<`alter table public.t add column body text;`>, DbOneColTable>
type AfterAlterCols = AlterAdd[1] extends { schemas: { public: { sets: { t: { columns: infer C } } } } } ? C : never
type _alterAddUsesDbScalars = Expect<Extends<AfterAlterCols extends { body: infer B } ? B : never, TNull<"text">>>

type MultiStmtDb = ApplyStatements<
	DbPublicEmpty,
	`
create table base ( id uuid not null );
create view v as select id from base;
`
>
type _applyNoErr = Expect<Matches<MultiStmtDb[1], null>>

describe("scalar types + database shape (type tests)", () => {
	it("compile-time assertions above", () => {})
})
