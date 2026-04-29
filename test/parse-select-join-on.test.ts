import { describe, it } from "node:test"
import type { JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../src/engine/sql-database.ts"

/**
 * Regression: after `JOIN schema.table`, the next token may be `ON` without an alias — `ParseAliasAfterTable`
 * must treat `on` like `where` / `order` (see branch that lists terminators before implicit alias).
 *
 * Regression: `ON` may use catalog-qualified columns (`auth.users.id = public.agenda.user_id`).
 */

/** Same multi-schema shape as the nest-postgres example (`auth.users`, `public.agenda`). */
type DbJoinAuthAgenda = ApplyStatements<
	SqlDatabase,
	`
create schema auth;
create schema public;
create table auth.users (
	id uuid not null,
	email text not null,
	display_name text null,
	created_at timestamp with time zone null
);
create table public.agenda ( id uuid not null, user_id uuid not null );
`
>[0]

type TJoinOnAliasPredicate = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users u left join public.agenda a on u.id = a.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnAliasPredicateOk = Expect<Extends<Tuple3At2<TJoinOnAliasPredicate>, JsqlSelectStatementResult>>

type TJoinOnCatalogPredicate = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users left join public.agenda on auth.users.id = public.agenda.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnCatalogPredicateOk = Expect<Extends<Tuple3At2<TJoinOnCatalogPredicate>, JsqlSelectStatementResult>>

type TJoinOnCatalogPredicateMultiLine = ParseSqlStatement<
	ParseSqlTokens<`
select
	email,
	display_name,
	auth.users.created_at,
	public.agenda.id as agenda_id
from auth.users left join public.agenda
on auth.users.id = public.agenda.user_id
order by email
;
`>,
	DbJoinAuthAgenda
>
type _joinOnCatalogPredicateMultiLineOk = Expect<
	Extends<Tuple3At2<TJoinOnCatalogPredicateMultiLine>, JsqlSelectStatementResult>
>
type _joinOnCatalogPredicateMultiLineColumns = Expect<
	Extends<
		Tuple3At2<TJoinOnCatalogPredicateMultiLine>,
		{
			kind: "select"
			columns: {
				email: string
				display_name: string | null
				created_at: string | null
				agenda_id: string
			}
			column_sql_types: {
				email: "text"
				display_name: "text"
				created_at: "timestamp with time zone"
				agenda_id: "uuid"
			}
		}
	>
>

/** nest-postgres `app-cli.ts`: qualified `.*`, unqualified joined columns, regex `WHERE`, `ORDER BY`. */
type TNestPostgresAppCliSelect = ParseSqlStatement<
	ParseSqlTokens<`
select
	public.agenda.*,
	email,
	display_name
from public.agenda
inner join auth.users
on auth.users.id = public.agenda.user_id
where email ~ '@example\\.com$'
order by display_name asc
;
`>,
	DbJoinAuthAgenda
>
type _nestPostgresAppCliSelectOk = Expect<Extends<Tuple3At2<TNestPostgresAppCliSelect>, JsqlSelectStatementResult>>
type _nestPostgresAppCliSelectColumns = Expect<
	Extends<
		Tuple3At2<TNestPostgresAppCliSelect>,
		{
			kind: "select"
			columns: {
				id: string
				user_id: string
				email: string
				display_name: string | null
			}
			column_sql_types: {
				id: "uuid"
				user_id: "uuid"
				email: "text"
				display_name: "text"
			}
		}
	>
>

describe("parse-select JOIN … ON (type tests)", () => {
	it("compile-time assertions above", () => {})
})
