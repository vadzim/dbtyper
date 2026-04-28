import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** Concrete `sets` keys only — `HasConcreteSet` is false when an index signature is merged in. */
type DbAuthItems = {
	defaultSchema: "auth"
	schemas: {
		auth: {
			sets: {
				items: { kind: "table"; columns: { id: string }; column_sql_types: { id: "uuid" } }
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
type _d2db = Expect<DbAuthItems extends D2[1] ? (D2[1] extends DbAuthItems ? true : false) : false>

type D3 = ParseSqlStatement<ParseSqlTokens<`drop table ghost;`>, DbAuthItems>
type _d3err = Expect<Matches<D3[2], SqlParserError<"Table does not exist; use IF EXISTS">>>

/** DB whose default schema is `public` and that schema exists (unqualified names land here). */
type DbDefaultPublicWithNotifications = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				notifications: { kind: "table"; columns: { id: string }; column_sql_types: { id: "uuid" } }
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
				invoices: { kind: "table"; columns: { amount: string }; column_sql_types: { amount: "numeric" } }
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
				v_reports: { kind: "view"; columns: { id: string }; column_sql_types: { id: "uuid" } }
			}
		}
	}
}

type DDropViewAsTable = ParseSqlStatement<ParseSqlTokens<`drop table v_reports;`>, DbWithView>
type _dDropViewErr = Expect<
	DDropViewAsTable[2] extends SqlParserError<"DROP TABLE targets a view; use DROP VIEW"> ? true : false
>

type DDropViewIfExists = ParseSqlStatement<ParseSqlTokens<`drop table if exists v_reports;`>, DbWithView>
type _dDropViewIfExistsNoop = Expect<
	DDropViewIfExists[2] extends null ? (DDropViewIfExists[1] extends DbWithView ? true : false) : false
>

type DUnknownSchema = ParseSqlStatement<ParseSqlTokens<`drop table missing_schema.widgets;`>, DbBillingAndPublic>
type _dUnknownSchema = Expect<DUnknownSchema[2] extends SqlParserError<string> ? true : false>

type DGarbage = ParseSqlStatement<ParseSqlTokens<`drop table auth.items extra ;`>, DbAuthItems>
type _dGarbage = Expect<
	DGarbage[2] extends SqlParserError<"Expected `;` after qualified table name in DROP TABLE"> ? true : false
>

describe("parse-drop-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
