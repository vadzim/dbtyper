/**
 * Migration DDL: statements parsed as ignorable under recovering parse (COMMENT, GRANT, SET, PL/pgSQL-ish bodies, etc.).
 */
import { describe, it } from "node:test"
import type { ParseSqlStatementsRecovering } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SkippedStatement } from "../parser/skip-statement.js"

type SkipCommentGrantSet = ParseSqlStatementsRecovering<
	ParseSqlTokens<`
	comment on table public.t is 'x';
	grant select on table public.t to anon;
	set search_path = public;
`>
>
type _SkipCommentGrantSet = Expect<
	Matches<
		SkipCommentGrantSet,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ";"
				},
				{
					kind: "skipped-statement"
					token: ";"
				},
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

type SkipAlterDefaultPrivileges = ParseSqlStatementsRecovering<
	ParseSqlTokens<`alter default privileges in schema public grant select on tables to anon;`>
>
type _SkipAlterDefaultPrivileges = Expect<
	Matches<
		SkipAlterDefaultPrivileges,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

type SkipDollarFn = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function app.f() returns int language sql as $$ select 1 $$;`>
>
type _SkipDollarFn = Expect<
	Matches<
		SkipDollarFn,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

type SkipTaggedDollarFn = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function app.g() returns int language sql as $fn$ select 1 $fn$;`>
>
type _SkipTaggedDollarFn = Expect<
	Matches<
		SkipTaggedDollarFn,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

type BareSelectRecovering = ParseSqlStatementsRecovering<ParseSqlTokens<`select 1`>>
type _BareSelectRecovering = Expect<
	Matches<
		BareSelectRecovering,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ""
				},
			],
			EmptyTokenList,
		]
	>
>

type UnclosedDollarIgnored = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function x() returns void as $fn$ select 1`>
>
type _UnclosedDollarIgnored = Expect<
	Matches<
		UnclosedDollarIgnored,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ""
				},
			],
			EmptyTokenList,
		]
	>
>

type CreateViewIgnorable = ParseSqlStatementsRecovering<ParseSqlTokens<`create view v as select 1;`>>
type _CreateViewIgnorable = Expect<
	Matches<
		CreateViewIgnorable,
		[
			readonly [
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
			EmptyTokenList,
		]
	>
>

describe("sql migration recovering ignorables (type tests)", () => {
	it("should run", () => {})
})
