/**
 * SqlApplyStatement foreign-key and cross-schema reference tests.
 */
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlEmptyDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatement } from "../engine/sql-apply-statement.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

type _DbFromSchemasKind = Expect<
	Matches<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
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

type _SchemaDuplicateTables = Expect<
	Matches<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<"create table users (id int not null)">
			>,
			SqlStatement<`create table "users" (other_id int not null)`>
		>,
		SqlParseError<"Duplicate table name: users">
	>
>

type SchemaWithInvalidTable = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	SqlStatement<"select * from users">
>
type _SchemaWithInvalidTable = Expect<Matches<SchemaWithInvalidTable, SqlParseError<"Unknown sql statement">>>

// --- Intra-schema FK ---

type BadIntraFkTable = SqlStatement<`
	create table posts_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users_bad(id)
	)
`>
type SchemaWithBadIntraFk = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	BadIntraFkTable
>
type _SchemaWithBadIntraFk = Expect<
	Matches<SchemaWithBadIntraFk, SqlParseError<`Unknown referenced table "users_bad" in schema`>>
>

/** Unqualified FK to another table in the same schema (happy path). */
type PostsRefUsersTable = SqlStatement<`
	create table post_refs (
		id int not null,
		author_id int not null,
		foreign key (author_id) references users(id)
	)
`>
type SchemaWithIntraFkOk = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	PostsRefUsersTable
>
type _SchemaWithIntraFkOk = Expect<
	Matches<
		SchemaWithIntraFkOk,
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
type CategoriesTable = SqlStatement<`
	create table categories (
		id int not null,
		parent_id int,
		foreign key (parent_id) references categories(id)
	)
`>
type SchemaSelfRef = SqlApplyStatement<
	SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
	CategoriesTable
>
type _SchemaSelfRef = Expect<
	Matches<
		SchemaSelfRef,
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
type PairRefTable = SqlStatement<`
	create table pair_refs (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id, u_email) references users(id, email)
	)
`>
type SchemaCompositeFkOk = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	PairRefTable
>
type _SchemaCompositeFkOk = Expect<
	Matches<
		SchemaCompositeFkOk,
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

type PairRefBadColTable = SqlStatement<`
	create table pair_refs_bad (
		id int not null,
		u_id int not null,
		u_nope text not null,
		foreign key (u_id, u_nope) references users(id, no_such_col)
	)
`>
type SchemaCompositeFkBadCol = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	PairRefBadColTable
>
type _SchemaCompositeFkBadCol = Expect<
	Matches<SchemaCompositeFkBadCol, SqlParseError<`Unknown column "no_such_col" referenced in table constraint`>>
>

/** Composite FK: fewer local columns than referenced columns. */
type PairRefArityShortTable = SqlStatement<`
	create table pair_arity_short (
		x int not null,
		foreign key (x) references users(id, email)
	)
`>
type _PairRefArityShortIsParseError = Expect<
	Matches<
		PairRefArityShortTable,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>
type SchemaCompositeArityShort = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	PairRefArityShortTable
>
type _SchemaCompositeArityShort = Expect<
	Matches<
		SchemaCompositeArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

/** Composite FK: more local columns than referenced columns. */
type PairRefArityLongTable = SqlStatement<`
	create table pair_arity_long (
		x int not null,
		y int not null,
		foreign key (x, y) references users(id)
	)
`>
type _PairRefArityLongIsParseError = Expect<
	Matches<
		PairRefArityLongTable,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>
type SchemaCompositeArityLong = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	PairRefArityLongTable
>
type _SchemaCompositeArityLong = Expect<
	Matches<
		SchemaCompositeArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

/** Several foreign keys on one table (intra-schema), all valid. */
type MembershipsTable = SqlStatement<`
	create table memberships (
		id int not null,
		user_id int not null,
		post_id int not null,
		foreign key (user_id) references users(id),
		foreign key (post_id) references posts(id)
	)
`>
type SchemaMultiFkOk = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
			SqlStatement<`create table users (id int not null, email text not null)`>
		>,
		SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
	>,
	MembershipsTable
>
type _SchemaMultiFkOk = Expect<
	Matches<
		SchemaMultiFkOk,
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
type MultiFkOneBadTable = SqlStatement<`
	create table multi_fk_bad (
		id int not null,
		user_id int not null,
		ghost_id int not null,
		foreign key (user_id) references users(id),
		foreign key (ghost_id) references ghosts(id)
	)
`>
type SchemaMultiFkOneBad = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
		SqlStatement<`create table users (id int not null, email text not null)`>
	>,
	MultiFkOneBadTable
>
type _SchemaMultiFkOneBad = Expect<
	Matches<SchemaMultiFkOneBad, SqlParseError<`Unknown referenced table "ghosts" in schema`>>
>

// --- Cross-schema FK (qualified `sales.*` tables) ---

type SalesOrdersTable = SqlStatement<`
	create table sales.orders (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type MultiSchemaDb = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesOrdersTable
>
type _MultiSchemaDb = Expect<
	Matches<
		MultiSchemaDb,
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
type SalesMultiRefTable = SqlStatement<`
	create table sales.link_rows (
		id int not null,
		u int not null,
		p int not null,
		foreign key (u) references public.users(id),
		foreign key (p) references public.posts(id)
	)
`>
type DbMultiFkCrossSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesMultiRefTable
>
type _DbMultiFkCrossSchema = Expect<
	Matches<
		DbMultiFkCrossSchema,
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
type SalesMultiRefOneBadTable = SqlStatement<`
	create table sales.link_bad (
		id int not null,
		u int not null,
		x int not null,
		foreign key (u) references public.users(id),
		foreign key (x) references public.no_such_posts(id)
	)
`>
type SalesMultiRefOneBadSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesMultiRefOneBadTable
>
type _DbMultiFkOneBadCross = Expect<
	Matches<SalesMultiRefOneBadSchema, SqlParseError<`Unknown referenced table "public.no_such_posts" in database`>>
>

type SalesOrdersDefaultSchemaTable = SqlStatement<`
	create table sales.orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type DbWithDefaultSchemaPublic = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesOrdersDefaultSchemaTable
>
type _DbWithDefaultSchemaPublic = Expect<
	Matches<
		DbWithDefaultSchemaPublic,
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

type SharedUsersTable = SqlStatement<`
	create table users (
		id int not null
	)
`>
type DbWithCustomDefaultSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<
					SqlApplyStatement<
						SqlApplyStatement<SqlEmptyDatabase<"shared">, SqlStatement<`create schema public`>>,
						SqlStatement<`create table public.users (id int not null, email text not null)`>
					>,
					SqlStatement<`create table public.posts (id int not null, user_id int not null, title text)`>
				>,
				SqlStatement<`create schema shared`>
			>,
			SharedUsersTable
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesOrdersDefaultSchemaTable
>
type _DbWithCustomDefaultSchema = Expect<
	Matches<
		DbWithCustomDefaultSchema,
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

type SalesBadSchemaRefTable = SqlStatement<`
	create table sales.orders_bad_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references missing_schema.users(id)
	)
`>
type SalesBadSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesBadSchemaRefTable
>
type _DbWithBadSchemaRef = Expect<
	Matches<SalesBadSchema, SqlParseError<`Unknown referenced schema "missing_schema" in database`>>
>

type SalesBadTableRefTable = SqlStatement<`
	create table sales.orders_bad_table (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.missing_table(id)
	)
`>
type SalesBadTableSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesBadTableRefTable
>
type _DbWithBadTableRef = Expect<
	Matches<SalesBadTableSchema, SqlParseError<`Unknown referenced table "public.missing_table" in database`>>
>

type SalesBadPublicUsersBadRefTable = SqlStatement<`
	create table sales.orders_bad_public_users_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users_bad(id)
	)
`>
type SalesBadPublicUsersBadSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesBadPublicUsersBadRefTable
>
type _DbWithBadPublicUsersBadRef = Expect<
	Matches<SalesBadPublicUsersBadSchema, SqlParseError<`Unknown referenced table "public.users_bad" in database`>>
>

type SalesBadSchemaUsersRefTable = SqlStatement<`
	create table sales.orders_bad_schema_users (
		id int not null,
		user_id int not null,
		foreign key (user_id) references schema_bad.users(id)
	)
`>
type SalesBadSchemaUsersSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesBadSchemaUsersRefTable
>
type _DbWithBadSchemaUsersRef = Expect<
	Matches<SalesBadSchemaUsersSchema, SqlParseError<`Unknown referenced schema "schema_bad" in database`>>
>

type SalesBadColumnRefTable = SqlStatement<`
	create table sales.orders_bad_column (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(missing_col)
	)
`>
type SalesBadColumnSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesBadColumnRefTable
>
type _DbWithBadColumnRef = Expect<
	Matches<SalesBadColumnSchema, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** No schemas: `CREATE TABLE sales.*` fails before FK checks (sales must exist first). */
type DbMissingDefaultSchema = SqlApplyStatement<SqlEmptyDatabase<"public">, SalesOrdersDefaultSchemaTable>
type _DbMissingDefaultSchema = Expect<
	Matches<DbMissingDefaultSchema, SqlParseError<`Unknown schema "sales" (use CREATE SCHEMA first)`>>
>

/**
 * Default schema `shared` but FK uses unqualified `users` → should resolve to `shared.users` at validation;
 * shared has only `teams` (apply chain); sales holds `users` stub + `orders_unq`.
 */
type SharedTeamsTable = SqlStatement<`
	create table shared.teams (
		id int not null
	)
`>
type SalesUsersStubTable = SqlStatement<"create table sales.users (id int not null)">
type SalesOrdersUnqualifiedUsersTable = SqlStatement<`
	create table sales.orders_unq (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
type DbBadUnqualifiedUnderCustomDefault = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<
					SqlApplyStatement<
						SqlApplyStatement<
							SqlApplyStatement<SqlEmptyDatabase<"shared">, SqlStatement<`create schema public`>>,
							SqlStatement<`create table public.users (id int not null, email text not null)`>
						>,
						SqlStatement<`create table public.posts (id int not null, user_id int not null, title text)`>
					>,
					SqlStatement<`create schema shared`>
				>,
				SharedTeamsTable
			>,
			SqlStatement<`create schema sales`>
		>,
		SalesUsersStubTable
	>,
	SalesOrdersUnqualifiedUsersTable
>
type _DbBadUnqualifiedUnderCustomDefault = Expect<
	Matches<DbBadUnqualifiedUnderCustomDefault, SqlParseError<`Unknown referenced table "shared.users" in database`>>
>

/** Composite FK across schemas: second column wrong on remote (row still parses; apply merges). */
type SalesCompositeBadTable = SqlStatement<`
	create table sales.orders_comp_bad (
		id int not null,
		a int not null,
		b text not null,
		foreign key (a, b) references public.users(id, not_a_column)
	)
`>
type SalesCompositeBadSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesCompositeBadTable
>
type _DbCompositeBadRemoteCol = Expect<
	Matches<SalesCompositeBadSchema, SqlParseError<`Unknown column "not_a_column" referenced in table constraint`>>
>

/** Database-level composite FK arity mismatch surfaces as parse error on the statement. */
type SalesDbArityShortTable = SqlStatement<`
	create table sales.db_arity_short (
		a int not null,
		foreign key (a) references public.users(id, email)
	)
`>
type _SalesDbArityShortIsParseError = Expect<
	Matches<
		SalesDbArityShortTable,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>
type SalesDbArityShortSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<
				SqlApplyStatement<SqlEmptyDatabase<"public">, SqlStatement<`create schema public`>>,
				SqlStatement<`create table users (id int not null, email text not null)`>
			>,
			SqlStatement<`create table posts (id int not null, user_id int not null, title text)`>
		>,
		SqlStatement<`create schema sales`>
	>,
	SalesDbArityShortTable
>
type _DbCompositeArityShort = Expect<
	Matches<
		SalesDbArityShortSchema,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql references", () => {
	it("should run", () => {})
})
