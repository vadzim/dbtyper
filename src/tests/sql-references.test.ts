/**
 * SqlApplyStatements foreign-key and cross-schema reference tests.
 */
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlEmptyDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

type DbFromSchemasKind = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
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

type DbDuplicateUsersTables = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<"create table users (id int not null)">,
		SqlStatement<`create table "users" (other_id int not null)`>,
	]
>

type _DbDuplicateUsersTables = Expect<Matches<DbDuplicateUsersTables, SqlParseError<"Duplicate table name: users">>>

type DbSelectFromUsersAfterCreate = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<"select * from users">,
	]
>

type _DbSelectFromUsersAfterCreate = Expect<
	Matches<DbSelectFromUsersAfterCreate, SqlParseError<"Unknown sql statement">>
>

// --- Intra-schema FK ---

type DbPostsBadIntraFk = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
			create table posts_bad (
				id int not null,
				user_id int not null,
				foreign key (user_id) references users_bad(id)
			)
		`>,
	]
>

type _DbPostsBadIntraFk = Expect<
	Matches<DbPostsBadIntraFk, SqlParseError<`Unknown referenced table "users_bad" in schema`>>
>

/** Unqualified FK to another table in the same schema (happy path). */

type DbPostRefsIntraFk = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
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
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`
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
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
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

type DbCompositeFkPairRefsBadCol = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
			create table pair_refs_bad (
				id int not null,
				u_id int not null,
				u_nope text not null,
				foreign key (u_id, u_nope) references users(id, no_such_col)
			)
		`>,
	]
>

type _DbCompositeFkPairRefsBadCol = Expect<
	Matches<DbCompositeFkPairRefsBadCol, SqlParseError<`Unknown column "no_such_col" referenced in table constraint`>>
>

/** Composite FK: fewer local columns than referenced columns. */

type StmtPairRefArityShort = SqlStatement<`
	create table pair_arity_short (
		x int not null,
		foreign key (x) references users(id, email)
	)
`>

type _StmtPairRefArityShort = Expect<
	Matches<
		StmtPairRefArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

type DbPairRefArityShort = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
			create table pair_arity_short (
				x int not null,
				foreign key (x) references users(id, email)
			)
		`>,
	]
>

type _DbPairRefArityShort = Expect<
	Matches<
		DbPairRefArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

/** Composite FK: more local columns than referenced columns. */

type StmtPairRefArityLong = SqlStatement<`
	create table pair_arity_long (
		x int not null,
		y int not null,
		foreign key (x, y) references users(id)
	)
`>

type _StmtPairRefArityLong = Expect<
	Matches<
		StmtPairRefArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

type DbPairRefArityLong = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
			create table pair_arity_long (
				x int not null,
				y int not null,
				foreign key (x, y) references users(id)
			)
		`>,
	]
>

type _DbPairRefArityLong = Expect<
	Matches<
		DbPairRefArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

/** Several foreign keys on one table (intra-schema), all valid. */

type DbMembershipsMultiFk = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`
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

/** Several FKs on one table: first OK, second references missing table. */

type DbMultiFkOneBad = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`
			create table multi_fk_bad (
				id int not null,
				user_id int not null,
				ghost_id int not null,
				foreign key (user_id) references users(id),
				foreign key (ghost_id) references ghosts(id)
			)
		`>,
	]
>

type _DbMultiFkOneBad = Expect<Matches<DbMultiFkOneBad, SqlParseError<`Unknown referenced table "ghosts" in schema`>>>

// --- Cross-schema FK (qualified `sales.*` tables) ---

type DbSalesOrders = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
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
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
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

/** Several cross-schema FKs: one valid, one bad table in public. */

type DbSalesLinkBad = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.link_bad (
				id int not null,
				u int not null,
				x int not null,
				foreign key (u) references public.users(id),
				foreign key (x) references public.no_such_posts(id)
			)
		`>,
	]
>

type _DbSalesLinkBad = Expect<
	Matches<DbSalesLinkBad, SqlParseError<`Unknown referenced table "public.no_such_posts" in database`>>
>

type DbSalesOrdersDefaultSchema = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
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
	SqlEmptyDatabase<"shared">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table public.users (id int not null, email text not null)`>,
		SqlStatement<`create table public.posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema shared`>,
		SqlStatement<`create table users (id int not null)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
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

// --- Cross-schema failure shapes (apply rejects with database-level FK errors) ---

type DbSalesBadSchemaRef = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_bad_schema (
				id int not null,
				user_id int not null,
				foreign key (user_id) references missing_schema.users(id)
			)
		`>,
	]
>

type _DbSalesBadSchemaRef = Expect<
	Matches<DbSalesBadSchemaRef, SqlParseError<`Unknown referenced schema "missing_schema" in database`>>
>

type DbSalesBadTableRef = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_bad_table (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.missing_table(id)
			)
		`>,
	]
>

type _DbSalesBadTableRef = Expect<
	Matches<DbSalesBadTableRef, SqlParseError<`Unknown referenced table "public.missing_table" in database`>>
>

type DbSalesBadPublicUsersBadRef = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_bad_public_users_bad (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users_bad(id)
			)
		`>,
	]
>

type _DbSalesBadPublicUsersBadRef = Expect<
	Matches<DbSalesBadPublicUsersBadRef, SqlParseError<`Unknown referenced table "public.users_bad" in database`>>
>

type DbSalesBadSchemaUsersRef = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_bad_schema_users (
				id int not null,
				user_id int not null,
				foreign key (user_id) references schema_bad.users(id)
			)
		`>,
	]
>

type _DbSalesBadSchemaUsersRef = Expect<
	Matches<DbSalesBadSchemaUsersRef, SqlParseError<`Unknown referenced schema "schema_bad" in database`>>
>

type DbSalesBadColumnRef = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_bad_column (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users(missing_col)
			)
		`>,
	]
>

type _DbSalesBadColumnRef = Expect<
	Matches<DbSalesBadColumnRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** No schemas: `CREATE TABLE sales.*` fails before FK checks (sales must exist first). */

type DbMissingSalesSchema = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`
			create table sales.orders_default_schema (
				id int not null,
				user_id int not null,
				foreign key (user_id) references public.users(id)
			)
		`>,
	]
>

type _DbMissingSalesSchema = Expect<
	Matches<DbMissingSalesSchema, SqlParseError<`Unknown schema "sales" (use CREATE SCHEMA first)`>>
>

/**
 * Default schema `shared` but FK uses unqualified `users` → should resolve to `shared.users` at validation;
 * shared has only `teams` (apply chain); sales holds `users` stub + `orders_unq`.
 */

type DbUnqualifiedUsersWrongDefault = SqlApplyStatements<
	SqlEmptyDatabase<"shared">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table public.users (id int not null, email text not null)`>,
		SqlStatement<`create table public.posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema shared`>,
		SqlStatement<`create table shared.teams (id int not null)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`create table sales.users (id int not null)`>,
		SqlStatement<`
			create table sales.orders_unq (
				id int not null,
				user_id int not null,
				foreign key (user_id) references users(id)
			)
		`>,
	]
>

type _DbUnqualifiedUsersWrongDefault = Expect<
	Matches<DbUnqualifiedUsersWrongDefault, SqlParseError<`Unknown referenced table "shared.users" in database`>>
>

/** Composite FK across schemas: second column wrong on remote (row still parses; apply merges). */

type DbSalesCompositeBadRemoteCol = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.orders_comp_bad (
				id int not null,
				a int not null,
				b text not null,
				foreign key (a, b) references public.users(id, not_a_column)
			)
		`>,
	]
>

type _DbSalesCompositeBadRemoteCol = Expect<
	Matches<DbSalesCompositeBadRemoteCol, SqlParseError<`Unknown column "not_a_column" referenced in table constraint`>>
>

/** Database-level composite FK arity mismatch surfaces as parse error on the statement. */

type StmtSalesDbArityShort = SqlStatement<`
	create table sales.db_arity_short (
		a int not null,
		foreign key (a) references public.users(id, email)
	)
`>

type _StmtSalesDbArityShort = Expect<
	Matches<
		StmtSalesDbArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

type DbSalesDbArityShort = SqlApplyStatements<
	SqlEmptyDatabase<"public">,
	[
		SqlStatement<`create schema public`>,
		SqlStatement<`create table users (id int not null, email text not null)`>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>,
		SqlStatement<`create schema sales`>,
		SqlStatement<`
			create table sales.db_arity_short (
				a int not null,
				foreign key (a) references public.users(id, email)
			)
		`>,
	]
>

type _DbSalesDbArityShort = Expect<
	Matches<
		DbSalesDbArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql references", () => {
	it("should run", () => {})
})
