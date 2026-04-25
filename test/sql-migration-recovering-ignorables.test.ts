/**
 * Migration DDL: statements parsed as ignorable under recovering parse (COMMENT, GRANT, SET, PL/pgSQL-ish bodies, etc.).
 */
import { describe, it } from "node:test"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

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
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
			],
		]
	>
>

type BareSelectRecovering = ParseSqlStatementsRecovering<ParseSqlTokens<`select 1`>>
type _BareSelectRecovering = Expect<
	Matches<
		BareSelectRecovering,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"eot">
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"eot">
				},
			],
		]
	>
>

type CreateViewIgnorable = ParseSqlStatementsRecovering<ParseSqlTokens<`create view v as select 1;`>>
type _CreateViewIgnorable = Expect<
	Matches<
		CreateViewIgnorable,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenType<"key", ";">
				},
			],
		]
	>
>

describe("sql migration recovering ignorables (type tests)", () => {
	it("should run", () => {})
})
