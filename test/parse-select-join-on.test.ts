import { describe, it } from "node:test"
import type { JsqlSelectStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../src/core/sql-database.ts"
import type { TText, TUuid, TTimestamp, TNull } from "./test-utils/sql-type-helpers.ts"

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
	login_count integer not null,
	created_at timestamp with time zone null
);
create table public.agenda ( id uuid not null, user_id uuid not null );
`
>[0]

type TJoinOnAliasPredicate = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users u left join public.agenda a on u.id = a.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnAliasPredicateOk = Expect<Extends<TJoinOnAliasPredicate[2], JsqlSelectStatementResult>>

type TJoinOnCatalogPredicate = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users left join public.agenda on auth.users.id = public.agenda.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnCatalogPredicateOk = Expect<Extends<TJoinOnCatalogPredicate[2], JsqlSelectStatementResult>>

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
	Extends<TJoinOnCatalogPredicateMultiLine[2], JsqlSelectStatementResult>
>
type _joinOnCatalogPredicateMultiLineColumns = Expect<
	Extends<
		TJoinOnCatalogPredicateMultiLine[2],
		{
			kind: "select"
			columns: {
				email: { type: "text"; arg: null; nullable: false }
				display_name: { type: "text"; arg: null; nullable: true }
				created_at: { type: "timestamp with time zone"; arg: null; nullable: true }
				agenda_id: { type: "uuid"; arg: null; nullable: false }
			}
		}
	>
>

type TJoinOnAliasTypeMismatch = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users u left join public.agenda a on u.email = a.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnAliasTypeMismatchErr = Expect<
	Extends<TJoinOnAliasTypeMismatch[2], SqlParserError<"Incompatible types in JOIN ON">>
>

type TJoinOnQualifiedTypeMismatch = ParseSqlStatement<
	ParseSqlTokens<`select email from auth.users left join public.agenda on auth.users.email = public.agenda.user_id;`>,
	DbJoinAuthAgenda
>
type _joinOnQualifiedTypeMismatchErr = Expect<
	Extends<TJoinOnQualifiedTypeMismatch[2], SqlParserError<"Incompatible types in JOIN ON">>
>

/** nest-postgres `app-cli.ts`: qualified `.*`, unqualified joined columns, regex `WHERE` via `:emailPat`, `ORDER BY`. */
type TNestPostgresAppCliSelect = ParseSqlStatement<
	ParseSqlTokens<`
select
	public.agenda.*,
	email,
	display_name
from public.agenda
inner join auth.users
on auth.users.id = public.agenda.user_id
where email ~ :emailPat
order by display_name asc
;
`>,
	DbJoinAuthAgenda,
	{ emailPat: TText }
>
type _nestPostgresAppCliSelectOk = Expect<Extends<TNestPostgresAppCliSelect[2], JsqlSelectStatementResult>>
// Check individual columns instead of the whole structure
type _nestPostgresAppCliSelectId = Expect<Extends<TNestPostgresAppCliSelect[2]["columns"]["id"], TUuid>>
type _nestPostgresAppCliSelectUserId = Expect<Extends<TNestPostgresAppCliSelect[2]["columns"]["user_id"], TUuid>>
type _nestPostgresAppCliSelectEmail = Expect<Extends<TNestPostgresAppCliSelect[2]["columns"]["email"], TText>>
type _nestPostgresAppCliSelectDisplayName = Expect<
	Extends<TNestPostgresAppCliSelect[2]["columns"]["display_name"], TNull<"text">>
>

describe("parse-select JOIN … ON (type tests)", () => {
	it("compile-time assertions above", () => {})
})
