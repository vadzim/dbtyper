import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { MergeDbPreserveScalars } from "../src/core/sql-scalar-types.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/**
 * Intentionally non-default TS column types to prove CREATE TABLE uses `Db["scalarTypes"]`
 * (not a package default map).
 */
type OddScalarMap = {
	uuid: string
	text: number
	int: boolean
}

type DbEmpty = {
	defaultSchema: "public"
	schemas: {}
	scalarTypes: OddScalarMap
}

type DbPublicEmpty = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
	scalarTypes: OddScalarMap
}

type CoreNoScalars = {
	defaultSchema: "public"
	schemas: { public: { sets: { t: { kind: "table"; columns: {}; column_sql_types: {} } } } }
}
type MergedFromDb = MergeDbPreserveScalars<DbPublicEmpty, CoreNoScalars>
type _mergeDbPreservesScalars = Expect<Matches<MergedFromDb["scalarTypes"], OddScalarMap>>

type CreatedSchema = ParseSqlStatement<ParseSqlTokens<`create schema extra;`>, DbEmpty>
type _createSchemaKeepsScalars = Expect<Matches<CreatedSchema[1]["scalarTypes"], OddScalarMap>>

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
			columns: { id: string; body: number; flag: boolean }
			column_sql_types: { id: "uuid"; body: "text"; flag: "int" }
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

/** `sets` must be a concrete key map (no `JsqlSchemaShape &` on `sets`) so `HasConcreteSet` is true for `DROP TABLE`. */
type DbOneTable = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				gone: {
					kind: "table"
					columns: { x: boolean }
					column_sql_types: { x: "int" }
				}
			}
		}
	}
	scalarTypes: OddScalarMap
}
type DropTable = ParseSqlStatement<ParseSqlTokens<`drop table gone;`>, DbOneTable>
type _dropTableKeepsScalars = Expect<Matches<DropTable[1]["scalarTypes"], OddScalarMap>>
type _dropTableSucceeded = Expect<Extends<DropTable[2], null>>

type DbTwoSchemas = {
	defaultSchema: "public"
	schemas: {
		public: { sets: {} }
		spare: { sets: {} }
	}
	scalarTypes: OddScalarMap
}
type DropSchema = ParseSqlStatement<ParseSqlTokens<`drop schema spare;`>, DbTwoSchemas>
type _dropSchemaKeepsScalars = Expect<Matches<DropSchema[1]["scalarTypes"], OddScalarMap>>
type _dropSchemaSucceeded = Expect<Extends<DropSchema[2], null>>

type DbOneColTable = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				t: {
					kind: "table"
					columns: { id: string }
					column_sql_types: { id: "uuid" }
				}
			}
		}
	}
	scalarTypes: OddScalarMap
}
type AlterAdd = ParseSqlStatement<ParseSqlTokens<`alter table public.t add column body text;`>, DbOneColTable>
type _alterAddKeepsScalars = Expect<Matches<AlterAdd[1]["scalarTypes"], OddScalarMap>>
type AfterAlterCols = AlterAdd[1]["schemas"]["public"]["sets"]["t"]["columns"]
type _alterAddUsesDbScalars = Expect<Extends<AfterAlterCols["body"], number>>

/** Multi-statement script: each merge preserves `scalarTypes` through {@link ApplyStatements}. */
type MultiStmtDb = ApplyStatements<
	DbPublicEmpty,
	`
create table base ( id uuid not null );
create view v as select id from base;
`
>
type _applyPreservesScalars = Expect<Matches<MultiStmtDb[0]["scalarTypes"], OddScalarMap>>
type _applyNoErr = Expect<Matches<MultiStmtDb[1], null>>

describe("scalar types + database shape (type tests)", () => {
	it("compile-time assertions above", () => {})
})
