import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** One base table used for single-clause `ALTER` success cases. */
type DbItems = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				items: {
					kind: "table"
					columns: { id: "uuid"; title: "text" }
					column_facts: { id: { not_null: true } }
				}
			}
		}
	}
}

type DbItemsWithDraft = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				items: {
					kind: "table"
					columns: { id: "uuid"; title: "text"; draft: "boolean" }
					column_facts: { id: { not_null: true } }
				}
			}
		}
	}
}

type TAlterAdd = ParseSqlStatement<ParseSqlTokens<`alter table public.items add column body text;`>, DbItems>
type _alterAddOk = Expect<Extends<Tuple3At2<TAlterAdd>, null>>
type ItemsAfterAdd = TAlterAdd[1]["schemas"]["public"]["sets"]["items"]
type _alterAddCols = Expect<Extends<ItemsAfterAdd["columns"], { id: "uuid"; title: "text"; body: "text" }>>

type TAlterDrop = ParseSqlStatement<ParseSqlTokens<`alter table public.items drop column draft;`>, DbItemsWithDraft>
type _alterDropOk = Expect<Extends<Tuple3At2<TAlterDrop>, null>>
type ItemsAfterDrop = TAlterDrop[1]["schemas"]["public"]["sets"]["items"]
type _alterDropCols = Expect<Extends<ItemsAfterDrop["columns"], { id: "uuid"; title: "text" }>>

type TAlterRename = ParseSqlStatement<ParseSqlTokens<`alter table public.items rename column title to label;`>, DbItems>
type _alterRenameOk = Expect<Extends<Tuple3At2<TAlterRename>, null>>
type ItemsAfterRename = TAlterRename[1]["schemas"]["public"]["sets"]["items"]
type _alterRenameCols = Expect<Extends<ItemsAfterRename["columns"], { id: "uuid"; label: "text" }>>

type TAlterType = ParseSqlStatement<ParseSqlTokens<`alter table public.items alter column id type bigint;`>, DbItems>
type _alterTypeOk = Expect<Extends<Tuple3At2<TAlterType>, null>>
type ItemsAfterType = TAlterType[1]["schemas"]["public"]["sets"]["items"]
type _alterTypeId = Expect<Extends<ItemsAfterType["columns"]["id"], "bigint">>

type TAlterSetNotNull = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column title set not null;`>,
	DbItems
>
type _alterSetNnOk = Expect<Extends<Tuple3At2<TAlterSetNotNull>, null>>
type ItemsAfterSetNn = TAlterSetNotNull[1]["schemas"]["public"]["sets"]["items"]
type _alterSetNnFact = Expect<Extends<ItemsAfterSetNn["column_facts"]["title"], { not_null: true }>>

type TAlterDropNotNull = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column id drop not null;`>,
	DbItems
>
type _alterDropNnOk = Expect<Extends<Tuple3At2<TAlterDropNotNull>, null>>
type ItemsAfterDropNn = TAlterDropNotNull[1]["schemas"]["public"]["sets"]["items"]
type _alterDropNnFact = Expect<Extends<ItemsAfterDropNn["column_facts"]["id"], { nullable: true }>>

/** `ADD CONSTRAINT` is a no-op (skip to `,`), then a real clause applies. */
type TAlterConstraintNoopThenAdd = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items add constraint chk check ( true ) , add column meta int;`>,
	DbItems
>
type _alterNoopChainOk = Expect<Extends<Tuple3At2<TAlterConstraintNoopThenAdd>, null>>
type ItemsAfterChain = TAlterConstraintNoopThenAdd[1]["schemas"]["public"]["sets"]["items"]
type _alterNoopChainMeta = Expect<Extends<ItemsAfterChain["columns"], { id: "uuid"; title: "text"; meta: "int" }>>

/** Unknown schema in qualified table name. */
type TAlterBadSchema = ParseSqlStatement<ParseSqlTokens<`alter table missing.items add column x int;`>, DbItems>
type _alterBadSchema = Expect<Extends<Tuple3At2<TAlterBadSchema>, SqlParserError<"Unknown schema for ALTER TABLE">>>

/** Unknown column in `DROP COLUMN`. */
type TAlterDropUnknownCol = ParseSqlStatement<ParseSqlTokens<`alter table public.items drop column ghost;`>, DbItems>
type _alterDropUnknownCol = Expect<Extends<Tuple3At2<TAlterDropUnknownCol>, SqlParserError<"Column does not exist">>>

/** Unknown old name in `RENAME COLUMN`. */
type TAlterRenameUnknownCol = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items rename column ghost to x;`>,
	DbItems
>
type _alterRenameUnknownCol = Expect<
	Extends<Tuple3At2<TAlterRenameUnknownCol>, SqlParserError<"Column does not exist">>
>

/** Unsupported action keyword after table name. */
type TAlterUnsupported = ParseSqlStatement<ParseSqlTokens<`alter table public.items freeze;`>, DbItems>
type _alterUnsupported = Expect<Extends<Tuple3At2<TAlterUnsupported>, SqlParserError<"Unsupported ALTER TABLE action">>>

/** Malformed `ALTER COLUMN` tail. */
type TAlterColBadSet = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column title set xyzzy;`>,
	DbItems
>
type _alterColBadSet = Expect<
	Extends<Tuple3At2<TAlterColBadSet>, SqlParserError<"Unsupported ALTER COLUMN SET clause">>
>

describe("parse-alter-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
