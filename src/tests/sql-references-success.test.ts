/**
 * SqlApplyStatements: successful foreign-key and cross-schema reference type tests.
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatements } from "../parser/parse-sql-statement.js"
import type { ParseSqlTokens } from "../parser/sql-tokens.js"

type DbFromSchemasKind = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text)
`>
	>[0]
>

type _DbFromSchemasKind = Expect<
	Matches<
		DbFromSchemasKind,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
				}
			}
		}
	>
>

// --- Intra-schema FK ---

/** Unqualified FK to another table in the same schema (happy path). */

type DbPostRefsIntraFk = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table post_refs (
		id int not null,
		author_id int not null,
		foreign key (author_id) references users(id)
	)
`>
	>[0]
>

type _DbPostRefsIntraFk = Expect<
	Matches<
		DbPostRefsIntraFk,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					post_refs: { id: number; author_id: number }
				}
			}
		}
	>
>

/** Self-referential FK within one schema. */

type DbCategoriesSelfRef = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table categories (
		id int not null,
		parent_id int,
		foreign key (parent_id) references categories(id)
	)
`>
	>[0]
>

type _DbCategoriesSelfRef = Expect<
	Matches<
		DbCategoriesSelfRef,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					categories: { id: number; parent_id: number | null }
				}
			}
		}
	>
>

/** Composite FK: both referenced columns must exist on target. */

type DbCompositeFkPairRefs = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table pair_refs (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id, u_email) references users(id, email)
	)
`>
	>[0]
>

type _DbCompositeFkPairRefs = Expect<
	Matches<
		DbCompositeFkPairRefs,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					pair_refs: { id: number; u_id: number; u_email: string }
				}
			}
		}
	>
>

/** Several foreign keys on one table (intra-schema), all valid. */

type DbMembershipsMultiFk = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create table memberships (
		id int not null,
		user_id int not null,
		post_id int not null,
		foreign key (user_id) references users(id),
		foreign key (post_id) references posts(id)
	)
`>
	>[0]
>

type _DbMembershipsMultiFk = Expect<
	Matches<
		DbMembershipsMultiFk,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
					memberships: { id: number; user_id: number; post_id: number }
				}
			}
		}
	>
>

// --- Cross-schema FK (qualified `sales.*` tables) ---

type DbSalesOrders = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
	>[0]
>

type _DbSalesOrders = Expect<
	Matches<
		DbSalesOrders,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
				}
				sales: {
					orders: { id: number; user_id: number }
				}
			}
		}
	>
>

/** Several FKs on one table, both targets in another schema (database-level). */

type DbSalesLinkRows = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.link_rows (
		id int not null,
		u int not null,
		p int not null,
		foreign key (u) references public.users(id),
		foreign key (p) references public.posts(id)
	)
`>
	>[0]
>

type _DbSalesLinkRows = Expect<
	Matches<
		DbSalesLinkRows,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
				}
				sales: {
					link_rows: { id: number; u: number; p: number }
				}
			}
		}
	>
>

type DbSalesOrdersDefaultSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
	>[0]
>

type _DbSalesOrdersDefaultSchema = Expect<
	Matches<
		DbSalesOrdersDefaultSchema,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
				}
				sales: {
					orders_default_schema: { id: number; user_id: number }
				}
			}
		}
	>
>

type DbSharedDefaultWithSalesOrders = SqlApplyStatements<
	SqlDatabase<"shared">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table public.users (id int not null, email text not null);
	create table public.posts (id int not null, user_id int not null, title text);
	create schema shared;
	create table users (id int not null);
	create schema sales;
	create table sales.orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
	>[0]
>

type _DbSharedDefaultWithSalesOrders = Expect<
	Matches<
		DbSharedDefaultWithSalesOrders,
		{
			readonly kind: "database"
			readonly defaultSchema: "shared"
			readonly schemas: {
				public: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number; title: string | null }
				}
				shared: {
					users: { id: number }
				}
				sales: {
					orders_default_schema: { id: number; user_id: number }
				}
			}
		}
	>
>

describe("sql references (success)", () => {
	it("should run", () => {})
})
