import { describe, it } from "node:test"
import type { JsqlSchemaShape, JsqlTableShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbPublicEmpty = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

type CreatedTable = ParseSqlStatement<
	ParseSqlTokens<`create table odd_cols ( id uuid not null, body text not null, flag int not null );`>,
	DbPublicEmpty
>
type OddTable = CreatedTable[1]["schemas"]["public"]["sets"]["odd_cols"]
type _oddColsFromScalarMap = Expect<
	Matches<
		OddTable,
		{
			kind: "table"
			columns: { id: "uuid"; body: "text"; flag: "int" }
			column_facts: {
				id: { nullability: "not_null" }
				body: { nullability: "not_null" }
				flag: { nullability: "not_null" }
			}
		}
	>
>

/** SQL type spelling absent from `scalarTypes` → TS column type `unknown` (via {@link SqlJoinedToTs}). */
type TinyScalars = { uuid: string }
type DbTiny = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
	scalarTypes: TinyScalars
}
type ExoticTable = ParseSqlStatement<
	ParseSqlTokens<`create table exotic ( id uuid not null, payload citext not null );`>,
	DbTiny
>
type ExoticCols = ExoticTable[1]["schemas"]["public"]["sets"]["exotic"]["columns"]
type _unmappedSqlTypeIsUnknown = Expect<Extends<ExoticCols["payload"], unknown>>

type DbOneTable = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				gone: {
					kind: "table"
					columns: { x: "int" }
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
		public: { sets: {} }
		spare: { sets: {} }
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
					columns: { id: "uuid" }
				}
			}
		}
	}
}
type AlterAdd = ParseSqlStatement<ParseSqlTokens<`alter table public.t add column body text;`>, DbOneColTable>
type AfterAlterCols = AlterAdd[1]["schemas"]["public"]["sets"]["t"]["columns"]
type _alterAddUsesDbScalars = Expect<Extends<AfterAlterCols["body"], "text">>

/** Multi-statement script: each merge preserves `scalarTypes` through {@link ApplyStatements}. */
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
