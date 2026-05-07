import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
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
} from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbAuthItems = {
	defaultSchema: "auth"
	schemas: {
		auth: {
			sets: {
				items: { kind: "table"; columns: { id: TUuid } }
			}
		}
	}
}

/** Matches `RemoveTableFromDb` shape: only `sets` remains on the updated schema object. */
type DbAuthItemsDropped = {
	defaultSchema: "auth"
	schemas: {
		auth: { sets: Omit<DbAuthItems["schemas"]["auth"]["sets"], "items"> }
	}
}

type D1 = ParseSqlStatement<ParseSqlTokens<`drop table auth.items;`>, DbAuthItems>
type _d1null = Expect<Matches<D1[2], null>>
type _d1shape = Expect<Matches<D1[1], DbAuthItemsDropped>>

type D1IfExists = ParseSqlStatement<ParseSqlTokens<`drop table if exists auth.items;`>, DbAuthItems>
type _d1IfExistsNull = Expect<Matches<D1IfExists[2], null>>
type _d1IfExistsShape = Expect<Matches<D1IfExists[1], DbAuthItemsDropped>>

type D2 = ParseSqlStatement<ParseSqlTokens<`drop table if exists ghost;`>, DbAuthItems>
type _d2null = Expect<Matches<D2[2], null>>
type _d2db = Expect<Matches<D2[1], DbAuthItems>>

type D3 = ParseSqlStatement<ParseSqlTokens<`drop table ghost;`>, DbAuthItems>
type _d3err = Expect<Matches<D3[2], SqlParserError<"Table does not exist; use IF EXISTS">>>

/** DB whose default schema is `public` and that schema exists (unqualified names land here). */
type DbDefaultPublicWithNotifications = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				notifications: { kind: "table"; columns: { id: TUuid } }
			}
		}
	}
}

type DbDefaultPublicDroppedNotifications = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: Omit<DbDefaultPublicWithNotifications["schemas"]["public"]["sets"], "notifications">
		}
	}
}

type D4 = ParseSqlStatement<ParseSqlTokens<`drop table notifications;`>, DbDefaultPublicWithNotifications>
type _d4null = Expect<Matches<D4[2], null>>
type _d4shape = Expect<Matches<D4[1], DbDefaultPublicDroppedNotifications>>

type DbBillingAndPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape; billing: JsqlSchemaShape }
}

type DbBillingWithInvoices = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape
		billing: {
			sets: {
				invoices: { kind: "table"; columns: { amount: TNumeric } }
			}
		}
	}
}

type DbBillingInvoicesDropped = {
	defaultSchema: "public"
	schemas: {
		public: DbBillingWithInvoices["schemas"]["public"]
		billing: { sets: Omit<DbBillingWithInvoices["schemas"]["billing"]["sets"], "invoices"> }
	}
}

type D5 = ParseSqlStatement<ParseSqlTokens<`drop table billing.invoices;`>, DbBillingWithInvoices>
type _d5null = Expect<Matches<D5[2], null>>
type _d5shape = Expect<Matches<D5[1], DbBillingInvoicesDropped>>

type DbWithView = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				v_reports: { kind: "view"; columns: { id: TUuid } }
			}
		}
	}
}

type DDropViewAsTable = ParseSqlStatement<ParseSqlTokens<`drop table v_reports;`>, DbWithView>
type _dDropViewErr = Expect<Extends<DDropViewAsTable[2], SqlParserError<"DROP TABLE targets a view; use DROP VIEW">>>

type DDropViewIfExists = ParseSqlStatement<ParseSqlTokens<`drop table if exists v_reports;`>, DbWithView>
type _dDropViewIfExistsNull = Expect<Matches<DDropViewIfExists[2], null>>
type _dDropViewIfExistsDb = Expect<Matches<DDropViewIfExists[1], DbWithView>>

type DUnknownSchema = ParseSqlStatement<ParseSqlTokens<`drop table missing_schema.widgets;`>, DbBillingAndPublic>
type _dUnknownSchema = Expect<Extends<DUnknownSchema[2], SqlParserError<string>>>

type DGarbage = ParseSqlStatement<ParseSqlTokens<`drop table auth.items extra ;`>, DbAuthItems>
type _dGarbage = Expect<Extends<DGarbage[2], SqlParserError<"Expected `;` after qualified table name in DROP TABLE">>>

describe("parse-drop-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
