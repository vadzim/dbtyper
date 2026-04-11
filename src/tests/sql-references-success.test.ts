/**
 * SqlApplyStatements: successful foreign-key and cross-schema reference type tests.
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"

type DbFromSchemasKind = SqlApplyStatements<
	SqlDatabase<"public">,
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table posts (id int not null, user_id int not null, title text)`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`
			create table post_refs (
				id int not null,
				author_id int not null,
				foreign key (author_id) references users(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`
			create table categories (
				id int not null,
				parent_id int,
				foreign key (parent_id) references categories(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`
			create table pair_refs (
				id int not null,
				u_id int not null,
				u_email text not null,
				foreign key (u_id, u_email) references users(id, email)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatementLoose<`
			create table memberships (
				id int not null,
				user_id int not null,
				post_id int not null,
				foreign key (user_id) references users(id),
				foreign key (post_id) references posts(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatementLoose<`create schema sales`>,
		SqlStatementLoose<`
			create table sales.orders (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatementLoose<`create schema sales`>,
		SqlStatementLoose<`
			create table sales.link_rows (
				id int not null,
				u int not null,
				p int not null,
				foreign key (u) references public.users(id),
				foreign key (p) references public.posts(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatementLoose<`create schema sales`>,
		SqlStatementLoose<`
			create table sales.orders_default_schema (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users(id)
			)
		`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create table public.users (id int not null, email text not null)`>,
		SqlStatementLoose<`create table public.posts (id int not null, user_id int not null, title text)`>,
		SqlStatementLoose<`create schema shared`>,
		SqlStatementLoose<`create table users (id int not null)`>,
		SqlStatementLoose<`create schema sales`>,
		SqlStatementLoose<`
			create table sales.orders_default_schema (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users(id)
			)
		`>,
	]
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
