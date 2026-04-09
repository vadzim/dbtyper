/**
 * SqlSchema / SqlDatabase foreign-key and cross-schema reference tests.
 */
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlSchema } from "../engine/sql-schema.js"
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Equal, Expect, Matches } from "./type-test-utils.js"
/**
 * Message from `SqlParseError<M>` (handles `never | SqlParseError<M>` from multi-ref validation unions).
 * Use only with `Equal<SqlParseMessage<T>, M>` or `Equal<..., A | B>` where each branch is a full string literal—never broad templates like `` `...${string}...` ``.
 */
type SqlParseMessage<T> = T extends SqlParseError<infer M> ? M : never

// --- Shared fixtures (minimal public schema) ---

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

type PublicSchema = SqlSchema<[UsersTable, PostsTable]>

// --- SqlSchema composition ---

type _PublicSchema = Expect<
	Matches<
		PublicSchema,
		{
			readonly kind: "schema"
			readonly tables: {
				users: { id: number; email: string }
				posts: { id: number; user_id: number; title: string | null }
			}
		}
	>
>

type DbFromSchemas = SqlDatabase<{ public: PublicSchema }>
type _DbgDbDefaultSchema = DbFromSchemas extends { readonly defaultSchema: infer D } ? D : never
type _DbgDbMigrations = DbFromSchemas extends { readonly migrations: infer M } ? M : never
type _DbFromSchemasKind = Expect<DbFromSchemas extends { readonly kind: "database" } ? true : false>
type _DbFromSchemasDefaultSchema = Expect<Equal<_DbgDbDefaultSchema, "public">>
type _DbFromSchemasSchemas = Expect<
	DbFromSchemas extends {
		readonly schemas: {
			public: {
				users: { id: number; email: string }
				posts: { id: number; user_id: number; title: string | null }
			}
		}
	}
		? true
		: false
>
type _DbFromSchemasMigrations = Expect<DbFromSchemas extends { readonly migrations: {} } ? true : false>

type DupUsersTableA = SqlCreateTable<"create table users (id int not null)">
type DupUsersTableB = SqlCreateTable<`create table "users" (other_id int not null)`>
type SchemaDuplicateTables = SqlSchema<[DupUsersTableA, DupUsersTableB]>
type _SchemaDuplicateTables = Expect<Equal<SchemaDuplicateTables, SqlParseError<"Duplicate table name: users">>>

type InvalidTable = SqlCreateTable<"select * from users">
type SchemaWithInvalidTable = SqlSchema<[UsersTable, InvalidTable]>
type _SchemaWithInvalidTable = Expect<
	Matches<SchemaWithInvalidTable, { readonly kind: "schema"; readonly tables: { users: unknown } }>
>

// --- Intra-schema FK ---

type BadIntraFkTable = SqlCreateTable<`
	create table posts_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users_bad(id)
	)
`>
type SchemaWithBadIntraFk = SqlSchema<[UsersTable, BadIntraFkTable]>
type _SchemaWithBadIntraFk = Expect<
	Equal<SchemaWithBadIntraFk, SqlParseError<`Unknown referenced table "users_bad" in schema`>>
>

/** Unqualified FK to another table in the same schema (happy path). */
type PostsRefUsersTable = SqlCreateTable<`
	create table post_refs (
		id int not null,
		author_id int not null,
		foreign key (author_id) references users(id)
	)
`>
type SchemaWithIntraFkOk = SqlSchema<[UsersTable, PostsRefUsersTable]>
type _SchemaWithIntraFkOk = Expect<
	Matches<
		SchemaWithIntraFkOk,
		{
			readonly kind: "schema"
			readonly tables: {
				users: unknown
				post_refs: unknown
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
type SchemaSelfRef = SqlSchema<[CategoriesTable]>
type _SchemaSelfRef = Expect<
	Matches<SchemaSelfRef, { readonly kind: "schema"; readonly tables: { categories: unknown } }>
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
type SchemaCompositeFkOk = SqlSchema<[UsersTable, PairRefTable]>
type _SchemaCompositeFkOk = Expect<
	Matches<SchemaCompositeFkOk, { readonly kind: "schema"; readonly tables: { users: unknown; pair_refs: unknown } }>
>

type PairRefBadColTable = SqlCreateTable<`
	create table pair_refs_bad (
		id int not null,
		u_id int not null,
		u_nope text not null,
		foreign key (u_id, u_nope) references users(id, no_such_col)
	)
`>
type SchemaCompositeFkBadCol = SqlSchema<[UsersTable, PairRefBadColTable]>
type _SchemaCompositeFkBadCol = Expect<
	Equal<SchemaCompositeFkBadCol, SqlParseError<`Unknown column "no_such_col" referenced in table constraint`>>
>

/** Composite FK: fewer local columns than referenced columns. */
type PairRefArityShortTable = SqlCreateTable<`
	create table pair_arity_short (
		x int not null,
		foreign key (x) references users(id, email)
	)
`>
type _PairRefArityShortIsParseError = Expect<
	Equal<
		PairRefArityShortTable,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>
type SchemaCompositeArityShort = SqlSchema<[UsersTable, PairRefArityShortTable]>
type _SchemaCompositeArityShort = Expect<
	Equal<
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
	Equal<
		PairRefArityLongTable,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>
type SchemaCompositeArityLong = SqlSchema<[UsersTable, PairRefArityLongTable]>
type _SchemaCompositeArityLong = Expect<
	Equal<
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
type SchemaMultiFkOk = SqlSchema<[UsersTable, PostsTable, MembershipsTable]>
type _SchemaMultiFkOk = Expect<
	Matches<
		SchemaMultiFkOk,
		{
			readonly kind: "schema"
			readonly tables: {
				users: unknown
				posts: unknown
				memberships: unknown
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
type SchemaMultiFkOneBad = SqlSchema<[UsersTable, MultiFkOneBadTable]>
type _SchemaMultiFkOneBad = Expect<
	Equal<SqlParseMessage<SchemaMultiFkOneBad>, `Unknown referenced table "ghosts" in schema`>
>

// --- Cross-schema (database-level) FK ---

type OrdersTable = SqlCreateTable<`
	create table orders (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type SalesSchema = SqlSchema<[OrdersTable]>
type MultiSchemaDb = SqlDatabase<{ public: PublicSchema; sales: SalesSchema }>
type _MultiSchemaDb = Expect<
	Matches<
		MultiSchemaDb,
		{
			readonly kind: "database"
			readonly schemas: { public: unknown; sales: unknown }
		}
	>
>

/** Several FKs on one table, both targets in another schema (database-level). */
type SalesMultiRefTable = SqlCreateTable<`
	create table link_rows (
		id int not null,
		u int not null,
		p int not null,
		foreign key (u) references public.users(id),
		foreign key (p) references public.posts(id)
	)
`>
type SalesMultiRefSchema = SqlSchema<[SalesMultiRefTable]>
type DbMultiFkCrossSchema = SqlDatabase<{ public: PublicSchema; sales: SalesMultiRefSchema }>
type _DbMultiFkCrossSchema = Expect<
	Matches<DbMultiFkCrossSchema, { readonly kind: "database"; readonly schemas: { public: unknown; sales: unknown } }>
>

/** Several cross-schema FKs: one valid, one bad table in public. */
type SalesMultiRefOneBadTable = SqlCreateTable<`
	create table link_bad (
		id int not null,
		u int not null,
		x int not null,
		foreign key (u) references public.users(id),
		foreign key (x) references public.no_such_posts(id)
	)
`>
type SalesMultiRefOneBadSchema = SqlSchema<[SalesMultiRefOneBadTable]>
type DbMultiFkOneBadCross = SqlDatabase<{ public: PublicSchema; sales: SalesMultiRefOneBadSchema }>
type _DbMultiFkOneBadCross = Expect<
	Equal<SqlParseMessage<DbMultiFkOneBadCross>, `Unknown referenced table "public.no_such_posts" in database`>
>

type OrdersDefaultSchemaTable = SqlCreateTable<`
	create table orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
type SalesSchemaDefaultSchemaRef = SqlSchema<[OrdersDefaultSchemaTable]>
type DbWithDefaultSchemaPublic = SqlDatabase<{ public: PublicSchema; sales: SalesSchemaDefaultSchemaRef }>
type _DbWithDefaultSchemaPublic = Expect<
	Matches<
		DbWithDefaultSchemaPublic,
		{ readonly kind: "database"; readonly schemas: { public: unknown; sales: unknown } }
	>
>

type SharedUsersTable = SqlCreateTable<`
	create table users (
		id int not null
	)
`>
type SharedSchema = SqlSchema<[SharedUsersTable]>
type DbWithCustomDefaultSchema = SqlDatabase<
	{ public: PublicSchema; shared: SharedSchema; sales: SalesSchemaDefaultSchemaRef },
	"shared"
>
type _DbWithCustomDefaultSchema = Expect<
	Matches<DbWithCustomDefaultSchema, { readonly kind: "database"; readonly schemas: unknown }>
>

// --- Database-level failures ---

type SalesBadSchemaRefTable = SqlCreateTable<`
	create table orders_bad_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references missing_schema.users(id)
	)
`>
type SalesBadSchema = SqlSchema<[SalesBadSchemaRefTable]>
type DbWithBadSchemaRef = SqlDatabase<{ public: PublicSchema; sales: SalesBadSchema }>
type _DbWithBadSchemaRef = Expect<
	Equal<DbWithBadSchemaRef, SqlParseError<`Unknown referenced schema "missing_schema" in database`>>
>

type SalesBadTableRefTable = SqlCreateTable<`
	create table orders_bad_table (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.missing_table(id)
	)
`>
type SalesBadTableSchema = SqlSchema<[SalesBadTableRefTable]>
type DbWithBadTableRef = SqlDatabase<{ public: PublicSchema; sales: SalesBadTableSchema }>
type _DbWithBadTableRef = Expect<
	Equal<DbWithBadTableRef, SqlParseError<`Unknown referenced table "public.missing_table" in database`>>
>

type SalesBadPublicUsersBadRefTable = SqlCreateTable<`
	create table orders_bad_public_users_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users_bad(id)
	)
`>
type SalesBadPublicUsersBadSchema = SqlSchema<[SalesBadPublicUsersBadRefTable]>
type DbWithBadPublicUsersBadRef = SqlDatabase<{ public: PublicSchema; sales: SalesBadPublicUsersBadSchema }>
type _DbWithBadPublicUsersBadRef = Expect<
	Equal<DbWithBadPublicUsersBadRef, SqlParseError<`Unknown referenced table "public.users_bad" in database`>>
>

type SalesBadSchemaUsersRefTable = SqlCreateTable<`
	create table orders_bad_schema_users (
		id int not null,
		user_id int not null,
		foreign key (user_id) references schema_bad.users(id)
	)
`>
type SalesBadSchemaUsersSchema = SqlSchema<[SalesBadSchemaUsersRefTable]>
type DbWithBadSchemaUsersRef = SqlDatabase<{ public: PublicSchema; sales: SalesBadSchemaUsersSchema }>
type _DbWithBadSchemaUsersRef = Expect<
	Equal<DbWithBadSchemaUsersRef, SqlParseError<`Unknown referenced schema "schema_bad" in database`>>
>

type SalesBadColumnRefTable = SqlCreateTable<`
	create table orders_bad_column (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(missing_col)
	)
`>
type SalesBadColumnSchema = SqlSchema<[SalesBadColumnRefTable]>
type DbWithBadColumnRef = SqlDatabase<{ public: PublicSchema; sales: SalesBadColumnSchema }>
type _DbWithBadColumnRef = Expect<
	Equal<DbWithBadColumnRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** DB has no `public` schema key but FK targets public.users — must fail. */
type DbMissingDefaultSchema = SqlDatabase<{ sales: SalesSchemaDefaultSchemaRef }>
type _DbMissingDefaultSchema = Expect<
	Equal<DbMissingDefaultSchema, SqlParseError<`Unknown referenced schema "public" in database`>>
>

/**
 * Default schema `shared` but FK uses unqualified `users` → resolves to shared.users at DB check;
 * shared schema has no users table → database-level missing table.
 * (Sales schema must include a local `users` stub so intra-schema FK validation passes.)
 */
type SalesUsersStubTable = SqlCreateTable<"create table users (id int not null)">
type OrdersUnqualifiedUsersTable = SqlCreateTable<`
	create table orders_unq (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
type SalesUnqualifiedUsersSchema = SqlSchema<[SalesUsersStubTable, OrdersUnqualifiedUsersTable]>
type SharedTeamsOnlySchema = SqlSchema<
	[
		SqlCreateTable<`
			create table teams (
				id int not null
			)
		`>,
	]
>
type DbBadUnqualifiedUnderCustomDefault = SqlDatabase<
	{ public: PublicSchema; shared: SharedTeamsOnlySchema; sales: SalesUnqualifiedUsersSchema },
	"shared"
>
type _DbBadUnqualifiedUnderCustomDefault = Expect<
	Equal<DbBadUnqualifiedUnderCustomDefault, SqlParseError<`Unknown referenced table "shared.users" in database`>>
>

/** Composite FK across schemas: second column wrong on remote table. */
type SalesCompositeBadTable = SqlCreateTable<`
	create table orders_comp_bad (
		id int not null,
		a int not null,
		b text not null,
		foreign key (a, b) references public.users(id, not_a_column)
	)
`>
type SalesCompositeBadSchema = SqlSchema<[SalesCompositeBadTable]>
type DbCompositeBadRemoteCol = SqlDatabase<{ public: PublicSchema; sales: SalesCompositeBadSchema }>
type _DbCompositeBadRemoteCol = Expect<
	Equal<DbCompositeBadRemoteCol, SqlParseError<`Unknown column "not_a_column" referenced in table constraint`>>
>

/** Database-level composite FK: arity mismatch (one local, two referenced). */
type SalesDbArityShortTable = SqlCreateTable<`
	create table db_arity_short (
		a int not null,
		foreign key (a) references public.users(id, email)
	)
`>
type _SalesDbArityShortIsParseError = Expect<
	Equal<
		SalesDbArityShortTable,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>
type SalesDbArityShortSchema = SqlSchema<[SalesDbArityShortTable]>
type DbCompositeArityShort = SqlDatabase<{ public: PublicSchema; sales: SalesDbArityShortSchema }>
type _DbCompositeArityShort = Expect<
	Equal<
		DbCompositeArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql references", () => {
	it("should run", () => {})
})
