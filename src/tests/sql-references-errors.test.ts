/**
 * SqlApplyStatements: foreign-key and cross-schema reference error type tests.
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { SqlStatements, SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { ParseSqlTokens, SqlParseError } from "../parser/sql-tokens.js"

type DbDuplicateUsersTables = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null);
	create table "users" (other_id int not null)
`>
	>[0]
>

type _DbDuplicateUsersTables = Expect<Matches<DbDuplicateUsersTables, SqlParseError<"Duplicate table name: users">>>

type DbSelectFromUsersAfterCreate = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	select * from users
`>
	>[0]
>

type _DbSelectFromUsersAfterCreate = Expect<Matches<DbSelectFromUsersAfterCreate, SqlParseError<"Unclosed statement">>>

// --- Intra-schema FK ---

type DbPostsBadIntraFk = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users_bad(id)
	)
`>
	>[0]
>

type _DbPostsBadIntraFk = Expect<
	Matches<DbPostsBadIntraFk, SqlParseError<`Unknown referenced table "users_bad" in schema`>>
>

type DbCompositeFkPairRefsBadCol = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table pair_refs_bad (
		id int not null,
		u_id int not null,
		u_nope text not null,
		foreign key (u_id, u_nope) references users(id, no_such_col)
	)
`>
	>[0]
>

type _DbCompositeFkPairRefsBadCol = Expect<
	Matches<DbCompositeFkPairRefsBadCol, SqlParseError<`Unknown column "no_such_col" referenced in table constraint`>>
>

/** Composite FK: fewer local columns than referenced columns. */

type StmtPairRefArityShort = SqlStatements<
	ParseSqlTokens<`
	create table pair_arity_short (
		x int not null,
		foreign key (x) references users(id, email)
	)
`>
>[0]

type _StmtPairRefArityShort = Expect<
	Matches<
		StmtPairRefArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

type DbPairRefArityShort = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table pair_arity_short (
		x int not null,
		foreign key (x) references users(id, email)
	)
`>
	>[0]
>

type _DbPairRefArityShort = Expect<
	Matches<
		DbPairRefArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

/** Composite FK: more local columns than referenced columns. */

type StmtPairRefArityLong = SqlStatements<
	ParseSqlTokens<`
	create table pair_arity_long (
		x int not null,
		y int not null,
		foreign key (x, y) references users(id)
	)
`>
>[0]

type _StmtPairRefArityLong = Expect<
	Matches<
		StmtPairRefArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

type DbPairRefArityLong = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table pair_arity_long (
		x int not null,
		y int not null,
		foreign key (x, y) references users(id)
	)
`>
	>[0]
>

type _DbPairRefArityLong = Expect<
	Matches<
		DbPairRefArityLong,
		SqlParseError<"Foreign key local column list has more entries than the referenced column list">
	>
>

/** Several FKs on one table: first OK, second references missing table. */

type DbMultiFkOneBad = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table multi_fk_bad (
		id int not null,
		user_id int not null,
		ghost_id int not null,
		foreign key (user_id) references users(id),
		foreign key (ghost_id) references ghosts(id)
	)
`>
	>[0]
>

type _DbMultiFkOneBad = Expect<Matches<DbMultiFkOneBad, SqlParseError<`Unknown referenced table "ghosts" in schema`>>>

// --- Cross-schema FK (qualified `sales.*` tables) ---

/** Several cross-schema FKs: one valid, one bad table in public. */

type DbSalesLinkBad = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.link_bad (
		id int not null,
		u int not null,
		x int not null,
		foreign key (u) references public.users(id),
		foreign key (x) references public.no_such_posts(id)
	)
`>
	>[0]
>

type _DbSalesLinkBad = Expect<
	Matches<DbSalesLinkBad, SqlParseError<`Unknown referenced table "public.no_such_posts" in database`>>
>

// --- Cross-schema failure shapes (apply rejects with database-level FK errors) ---

type DbSalesBadSchemaRef = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_bad_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references missing_schema.users(id)
	)
`>
	>[0]
>

type _DbSalesBadSchemaRef = Expect<
	Matches<DbSalesBadSchemaRef, SqlParseError<`Unknown referenced schema "missing_schema" in database`>>
>

type DbSalesBadTableRef = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_bad_table (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.missing_table(id)
	)
`>
	>[0]
>

type _DbSalesBadTableRef = Expect<
	Matches<DbSalesBadTableRef, SqlParseError<`Unknown referenced table "public.missing_table" in database`>>
>

type DbSalesBadPublicUsersBadRef = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_bad_public_users_bad (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users_bad(id)
	)
`>
	>[0]
>

type _DbSalesBadPublicUsersBadRef = Expect<
	Matches<DbSalesBadPublicUsersBadRef, SqlParseError<`Unknown referenced table "public.users_bad" in database`>>
>

type DbSalesBadSchemaUsersRef = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_bad_schema_users (
		id int not null,
		user_id int not null,
		foreign key (user_id) references schema_bad.users(id)
	)
`>
	>[0]
>

type _DbSalesBadSchemaUsersRef = Expect<
	Matches<DbSalesBadSchemaUsersRef, SqlParseError<`Unknown referenced schema "schema_bad" in database`>>
>

type DbSalesBadColumnRef = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_bad_column (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(missing_col)
	)
`>
	>[0]
>

type _DbSalesBadColumnRef = Expect<
	Matches<DbSalesBadColumnRef, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** No schemas: `CREATE TABLE sales.*` fails before FK checks (sales must exist first). */

type DbMissingSalesSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create table sales.orders_default_schema (
		id int not null,
		user_id int not null,
		foreign key (user_id) references public.users(id)
	)
`>
	>[0]
>

type _DbMissingSalesSchema = Expect<
	Matches<DbMissingSalesSchema, SqlParseError<`Unknown schema "sales" (use CREATE SCHEMA first)`>>
>

/**
 * Default schema `shared` but FK uses unqualified `users` → should resolve to `shared.users` at validation;
 * shared has only `teams` (apply chain); sales holds `users` stub + `orders_unq`.
 */

type DbUnqualifiedUsersWrongDefault = SqlApplyStatements<
	SqlDatabase<"shared">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table public.users (id int not null, email text not null);
	create table public.posts (id int not null, user_id int not null, title text);
	create schema shared;
	create table shared.teams (id int not null);
	create schema sales;
	create table sales.users (id int not null);
	create table sales.orders_unq (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
	>[0]
>

type _DbUnqualifiedUsersWrongDefault = Expect<
	Matches<DbUnqualifiedUsersWrongDefault, SqlParseError<`Unknown referenced table "shared.users" in database`>>
>

/** Composite FK across schemas: second column wrong on remote (row still parses; apply merges). */

type DbSalesCompositeBadRemoteCol = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.orders_comp_bad (
		id int not null,
		a int not null,
		b text not null,
		foreign key (a, b) references public.users(id, not_a_column)
	)
`>
	>[0]
>

type _DbSalesCompositeBadRemoteCol = Expect<
	Matches<DbSalesCompositeBadRemoteCol, SqlParseError<`Unknown column "not_a_column" referenced in table constraint`>>
>

/** Database-level composite FK arity mismatch surfaces as parse error on the statement. */

type StmtSalesDbArityShort = SqlStatements<
	ParseSqlTokens<`
	create table sales.db_arity_short (
		a int not null,
		foreign key (a) references public.users(id, email)
	)
`>
>[0]

type _StmtSalesDbArityShort = Expect<
	Matches<
		StmtSalesDbArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

type DbSalesDbArityShort = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<
		ParseSqlTokens<`
	create schema public;
	create table users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null, title text);
	create schema sales;
	create table sales.db_arity_short (
		a int not null,
		foreign key (a) references public.users(id, email)
	)
`>
	>[0]
>

type _DbSalesDbArityShort = Expect<
	Matches<
		DbSalesDbArityShort,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

type WrongStatementBeforeIncompletedStatementWithRecovering = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatementsRecovering<ParseSqlTokens<`create schema a; create schema a; select 1;`>>[0]
>

type _WrongStatementBeforeIncompletedStatementWithRecovering = Expect<
	Matches<WrongStatementBeforeIncompletedStatementWithRecovering, SqlParseError<"Duplicate schema name: a">>
>

type WrongStatementBeforeIncompletedStatementStrict = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<ParseSqlTokens<`create schema a; create schema a; select 1;`>>[0]
>

type _WrongStatementBeforeIncompletedStatementStrict = Expect<
	Matches<WrongStatementBeforeIncompletedStatementStrict, SqlParseError<"Duplicate schema name: a">>
>

describe("sql references (errors)", () => {
	it("should run", () => {})
})
