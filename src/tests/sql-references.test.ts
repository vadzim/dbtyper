/**
 * SqlApplyStatement foreign-key and cross-schema reference tests.
 */
import type { SqlCreateSchema } from "../parser/sql-create-schema.js"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlEmptyDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatement } from "../engine/sql-apply-statement.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

// --- Shared fixtures (minimal public schema) ---

type CreatePublicSchema = SqlCreateSchema<`create schema public`>
type CreateSalesSchema = SqlCreateSchema<`create schema sales`>
type CreateSharedSchema = SqlCreateSchema<`create schema shared`>

type UsersTable = SqlCreateTable<`
	create table users (
		id int not null,
		email text not null
	)
`>

type PostsTable = SqlCreateTable<`
	create table posts (
		id int not null,
		user_id int not null,
		title text
	)
`>

type DbUsersPosts = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	PostsTable
>

/** Same as DbUsersPosts plus empty `sales` schema (for `create table sales.*`). */
type DbUsersPostsAndSales = SqlApplyStatement<DbUsersPosts, CreateSalesSchema>

type UsersTableInPublic = SqlCreateTable<`
	create table public.users (
		id int not null,
		email text not null
	)
`>

type PostsTableInPublic = SqlCreateTable<`
	create table public.posts (
		id int not null,
		user_id int not null,
		title text
	)
`>

type PublicDbSharedDefault = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"shared">, CreatePublicSchema>, UsersTableInPublic>,
	PostsTableInPublic
>

type _DbFromSchemasKind = Expect<Matches<DbUsersPosts["kind"], "database">>
type _DbFromSchemasDefaultSchema = Expect<Matches<DbUsersPosts["defaultSchema"], "public">>
type _DbFromSchemasSchemas = Expect<
	Matches<
		DbUsersPosts["schemas"],
		{
			public: {
				users: { id: number; email: string }
				posts: { id: number; user_id: number; title: string | null }
			}
		}
	>
>

type DupUsersTableA = SqlCreateTable<"create table users (id int not null)">
type DupUsersTableB = SqlCreateTable<`create table "users" (other_id int not null)`>
type SchemaDuplicateTables = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, DupUsersTableA>,
	DupUsersTableB
>
type _SchemaDuplicateTables = Expect<Matches<SchemaDuplicateTables, SqlParseError<"Duplicate table name: users">>>

type InvalidTable = SqlStatement<"select * from users">
type SchemaWithInvalidTable = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	InvalidTable
>
type _SchemaWithInvalidTable = Expect<Matches<SchemaWithInvalidTable, SqlParseError<"Unknown sql statement">>>

// --- Intra-schema FK ---

type BadIntraFkTable = SqlCreateTable<`
	create table posts_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users_bad(id)
	)
`>
type SchemaWithBadIntraFk = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	BadIntraFkTable
>
type _SchemaWithBadIntraFk = Expect<
	Matches<SchemaWithBadIntraFk, SqlParseError<`Unknown referenced table "users_bad" in schema`>>
>

/** Unqualified FK to another table in the same schema (happy path). */
type PostsRefUsersTable = SqlCreateTable<`
	create table post_refs (
		id int not null,
		author_id int not null,
		foreign key (author_id) references users(id)
	)
`>
type SchemaWithIntraFkOk = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
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
type CategoriesTable = SqlCreateTable<`
	create table categories (
		id int not null,
		parent_id int,
		foreign key (parent_id) references categories(id)
	)
`>
type SchemaSelfRef = SqlApplyStatement<
	SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>,
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
type PairRefTable = SqlCreateTable<`
	create table pair_refs (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id, u_email) references users(id, email)
	)
`>
type SchemaCompositeFkOk = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
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

type PairRefBadColTable = SqlCreateTable<`
	create table pair_refs_bad (
		id int not null,
		u_id int not null,
		u_nope text not null,
		foreign key (u_id, u_nope) references users(id, no_such_col)
	)
`>
type SchemaCompositeFkBadCol = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	PairRefBadColTable
>
type _SchemaCompositeFkBadCol = Expect<
	Matches<SchemaCompositeFkBadCol, SqlParseError<`Unknown column "no_such_col" referenced in table constraint`>>
>

/** Composite FK: fewer local columns than referenced columns. */
type PairRefArityShortTable = SqlCreateTable<`
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
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	PairRefArityShortTable
>
type _SchemaCompositeArityShort = Expect<
	Matches<
		SchemaCompositeArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

/** Composite FK: more local columns than referenced columns. */
type PairRefArityLongTable = SqlCreateTable<`
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
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	PairRefArityLongTable
>
type _SchemaCompositeArityLong = Expect<
	Matches<
		SchemaCompositeArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

/** Several foreign keys on one table (intra-schema), all valid. */
type MembershipsTable = SqlCreateTable<`
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
		SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
		PostsTable
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
type MultiFkOneBadTable = SqlCreateTable<`
	create table multi_fk_bad (
		id int not null,
		user_id int not null,
		ghost_id int not null,
		foreign key (user_id) references users(id),
		foreign key (ghost_id) references ghosts(id)
	)
`>
type SchemaMultiFkOneBad = SqlApplyStatement<
	SqlApplyStatement<SqlApplyStatement<SqlEmptyDatabase<"public">, CreatePublicSchema>, UsersTable>,
	MultiFkOneBadTable
>
type _SchemaMultiFkOneBad = Expect<
	Matches<SchemaMultiFkOneBad, SqlParseError<`Unknown referenced table "ghosts" in schema`>>
>

// --- Cross-schema FK (qualified `sales.*` tables) ---

type SalesOrdersTable = SqlCreateTable<`
	create table sales.orders (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type MultiSchemaDb = SqlApplyStatement<DbUsersPostsAndSales, SalesOrdersTable>
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
type SalesMultiRefTable = SqlCreateTable<`
	create table sales.link_rows (
		id int not null,
		u int not null,
		p int not null,
		foreign key (u) references public.users(id),
		foreign key (p) references public.posts(id)
	)
`>
type DbMultiFkCrossSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesMultiRefTable>
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
type SalesMultiRefOneBadTable = SqlCreateTable<`
	create table sales.link_bad (
		id int not null,
		u int not null,
		x int not null,
		foreign key (u) references public.users(id),
		foreign key (x) references public.no_such_posts(id)
	)
`>
type SalesMultiRefOneBadSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesMultiRefOneBadTable>
type _DbMultiFkOneBadCross = Expect<
	Matches<SalesMultiRefOneBadSchema, SqlParseError<`Unknown referenced table "public.no_such_posts" in database`>>
>

type SalesOrdersDefaultSchemaTable = SqlCreateTable<`
	create table sales.orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type DbWithDefaultSchemaPublic = SqlApplyStatement<DbUsersPostsAndSales, SalesOrdersDefaultSchemaTable>
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

type SharedUsersTable = SqlCreateTable<`
	create table users (
		id int not null
	)
`>
type DbWithCustomDefaultSchema = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<SqlApplyStatement<PublicDbSharedDefault, CreateSharedSchema>, SharedUsersTable>,
		CreateSalesSchema
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

type SalesBadSchemaRefTable = SqlCreateTable<`
	create table sales.orders_bad_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references missing_schema.users(id)
	)
`>
type SalesBadSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesBadSchemaRefTable>
type _DbWithBadSchemaRef = Expect<
	Matches<SalesBadSchema, SqlParseError<`Unknown referenced schema "missing_schema" in database`>>
>

type SalesBadTableRefTable = SqlCreateTable<`
	create table sales.orders_bad_table (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.missing_table(id)
	)
`>
type SalesBadTableSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesBadTableRefTable>
type _DbWithBadTableRef = Expect<
	Matches<SalesBadTableSchema, SqlParseError<`Unknown referenced table "public.missing_table" in database`>>
>

type SalesBadPublicUsersBadRefTable = SqlCreateTable<`
	create table sales.orders_bad_public_users_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users_bad(id)
	)
`>
type SalesBadPublicUsersBadSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesBadPublicUsersBadRefTable>
type _DbWithBadPublicUsersBadRef = Expect<
	Matches<SalesBadPublicUsersBadSchema, SqlParseError<`Unknown referenced table "public.users_bad" in database`>>
>

type SalesBadSchemaUsersRefTable = SqlCreateTable<`
	create table sales.orders_bad_schema_users (
		id int not null,
		user_id int not null,
		foreign key (user_id) references schema_bad.users(id)
	)
`>
type SalesBadSchemaUsersSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesBadSchemaUsersRefTable>
type _DbWithBadSchemaUsersRef = Expect<
	Matches<SalesBadSchemaUsersSchema, SqlParseError<`Unknown referenced schema "schema_bad" in database`>>
>

type SalesBadColumnRefTable = SqlCreateTable<`
	create table sales.orders_bad_column (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(missing_col)
	)
`>
type SalesBadColumnSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesBadColumnRefTable>
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
type SharedTeamsTable = SqlCreateTable<`
	create table shared.teams (
		id int not null
	)
`>
type SalesUsersStubTable = SqlCreateTable<"create table sales.users (id int not null)">
type SalesOrdersUnqualifiedUsersTable = SqlCreateTable<`
	create table sales.orders_unq (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
type DbBadUnqualifiedUnderCustomDefault = SqlApplyStatement<
	SqlApplyStatement<
		SqlApplyStatement<
			SqlApplyStatement<SqlApplyStatement<PublicDbSharedDefault, CreateSharedSchema>, SharedTeamsTable>,
			CreateSalesSchema
		>,
		SalesUsersStubTable
	>,
	SalesOrdersUnqualifiedUsersTable
>
type _DbBadUnqualifiedUnderCustomDefault = Expect<
	Matches<DbBadUnqualifiedUnderCustomDefault, SqlParseError<`Unknown referenced table "shared.users" in database`>>
>

/** Composite FK across schemas: second column wrong on remote (row still parses; apply merges). */
type SalesCompositeBadTable = SqlCreateTable<`
	create table sales.orders_comp_bad (
		id int not null,
		a int not null,
		b text not null,
		foreign key (a, b) references public.users(id, not_a_column)
	)
`>
type SalesCompositeBadSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesCompositeBadTable>
type _DbCompositeBadRemoteCol = Expect<
	Matches<SalesCompositeBadSchema, SqlParseError<`Unknown column "not_a_column" referenced in table constraint`>>
>

/** Database-level composite FK arity mismatch surfaces as parse error on the statement. */
type SalesDbArityShortTable = SqlCreateTable<`
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
type SalesDbArityShortSchema = SqlApplyStatement<DbUsersPostsAndSales, SalesDbArityShortTable>
type _DbCompositeArityShort = Expect<
	Matches<
		SalesDbArityShortSchema,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql references", () => {
	it("should run", () => {})
})
