import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TText, TBoolean, TUuid, TNull } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** One base table used for single-clause `ALTER` success cases. */
type DbItems = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				items: {
					kind: "table"
					columns: { id: TUuid; title: TText }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type DbItemsWithDraft = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				items: {
					kind: "table"
					columns: { id: TUuid; title: TText; draft: TBoolean }
					column_facts: { id: { nullability: "not_null" } }
				}
			}
		}
	}
}

type TAlterAdd = ParseSqlStatement<ParseSqlTokens<`alter table public.items add column body text;`>, DbItems>
type _alterAddOk = Expect<Extends<TAlterAdd[2], null>>
type ItemsAfterAdd = TAlterAdd[1]["schemas"]["public"]["sets"]["items"]
type _alterAddCols = Expect<Extends<ItemsAfterAdd["columns"], { id: TUuid; title: TText; body: TNull<"text"> }>>

type TAlterDrop = ParseSqlStatement<ParseSqlTokens<`alter table public.items drop column draft;`>, DbItemsWithDraft>
type _alterDropOk = Expect<Extends<TAlterDrop[2], null>>
type ItemsAfterDrop = TAlterDrop[1]["schemas"]["public"]["sets"]["items"]
type _alterDropCols = Expect<Extends<ItemsAfterDrop["columns"], { id: TUuid; title: TText }>>

type TAlterRename = ParseSqlStatement<ParseSqlTokens<`alter table public.items rename column title to label;`>, DbItems>
type _alterRenameOk = Expect<Extends<TAlterRename[2], null>>
type ItemsAfterRename = TAlterRename[1]["schemas"]["public"]["sets"]["items"]
type _alterRenameCols = Expect<Extends<ItemsAfterRename["columns"], { id: TUuid; label: TText }>>

type TAlterType = ParseSqlStatement<ParseSqlTokens<`alter table public.items alter column id type bigint;`>, DbItems>
type _alterTypeOk = Expect<Extends<TAlterType[2], null>>
type ItemsAfterType = TAlterType[1]["schemas"]["public"]["sets"]["items"]
type _alterTypeId = Expect<Extends<ItemsAfterType["columns"]["id"], TNull<"bigint">>>

type TAlterSetNotNull = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column title set not null;`>,
	DbItems
>
type _alterSetNnOk = Expect<Extends<TAlterSetNotNull[2], null>>
type ItemsAfterSetNn = TAlterSetNotNull[1]["schemas"]["public"]["sets"]["items"]
type _alterSetNnFact = Expect<Extends<ItemsAfterSetNn["column_facts"]["title"], { nullability: "not_null" }>>

type TAlterDropNotNull = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column id drop not null;`>,
	DbItems
>
type _alterDropNnOk = Expect<Extends<TAlterDropNotNull[2], null>>
type ItemsAfterDropNn = TAlterDropNotNull[1]["schemas"]["public"]["sets"]["items"]
type _alterDropNnFact = Expect<Extends<ItemsAfterDropNn["column_facts"]["id"], { nullability: "nullable" }>>

/** `ADD CONSTRAINT` is a no-op (skip to `,`), then a real clause applies. */
type TAlterConstraintNoopThenAdd = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items add constraint chk check ( true ) , add column meta int;`>,
	DbItems
>
type _alterNoopChainOk = Expect<Extends<TAlterConstraintNoopThenAdd[2], null>>
type ItemsAfterChain = TAlterConstraintNoopThenAdd[1]["schemas"]["public"]["sets"]["items"]
type _alterNoopChainMeta = Expect<
	Extends<ItemsAfterChain["columns"], { id: TUuid; title: TText; meta: TNull<"integer"> }>
>

/** Malformed `ALTER COLUMN` tail. */
type TAlterColBadSet = ParseSqlStatement<
	ParseSqlTokens<`alter table public.items alter column title set xyzzy;`>,
	DbItems
>
type _alterColBadSet = Expect<Extends<TAlterColBadSet[2], DbtyperError<5403, "Unsupported ALTER COLUMN SET clause">>>

describe("parse-alter-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
