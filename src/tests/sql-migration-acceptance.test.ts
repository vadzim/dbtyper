/**
 * Migration-style DDL: ignorable skip, CREATE INDEX / INSERT validation, ALTER constraints, FK schema gating.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { IgnorableStatement } from "../parser/sql-ignorable.js"

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
			readonly [{ readonly kind: "ignorable" }, { readonly kind: "ignorable" }, { readonly kind: "ignorable" }],
			EmptyTokenList,
		]
	>
>

type SkipAlterDefaultPrivileges = ParseSqlStatementsRecovering<
	ParseSqlTokens<`alter default privileges in schema public grant select on tables to anon;`>
>
type _SkipAlterDefaultPrivileges = Expect<
	Matches<SkipAlterDefaultPrivileges, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type SkipDollarFn = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function app.f() returns int language sql as $$ select 1 $$;`>
>
type _SkipDollarFn = Expect<Matches<SkipDollarFn, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>>

type SkipTaggedDollarFn = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function app.g() returns int language sql as $fn$ select 1 $fn$;`>
>
type _SkipTaggedDollarFn = Expect<
	Matches<SkipTaggedDollarFn, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type BareSelectRecovering = ParseSqlStatementsRecovering<ParseSqlTokens<`select 1`>>
type _BareSelectRecovering = Expect<
	Matches<BareSelectRecovering, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type UnclosedDollarIgnored = ParseSqlStatementsRecovering<
	ParseSqlTokens<`create function x() returns void as $fn$ select 1`>
>
type _UnclosedDollarIgnored = Expect<Matches<UnclosedDollarIgnored, [readonly [IgnorableStatement], EmptyTokenList]>>

type CreateViewIgnorable = ParseSqlStatementsRecovering<ParseSqlTokens<`create view v as select 1;`>>
type _CreateViewIgnorable = Expect<
	Matches<CreateViewIgnorable, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

type ParseIndexOk = ParseSqlStatementsRecovering<
	ParseSqlTokens<`
	create schema app;
	create table app.items (id int not null, name text not null);
	create index items_name_idx on app.items (name, id);
`>
>
type _ParseIndexOk = Expect<
	Matches<
		ParseIndexOk,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "app"; readonly ifNotExists: false },
				{
					readonly kind: "create_table"
					readonly name: readonly ["items", "app"]
					readonly row: { id: number; name: string }
					readonly refs: undefined
				},
				{
					readonly kind: "create_index_validated"
					readonly unique: false
					readonly ifNotExists: false
					readonly target: readonly ["items", "app"]
					readonly columns: readonly ["name", "id"]
				},
			],
			EmptyTokenList,
		]
	>
>

type ApplyIndexBadCol = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null);
		create index i on app.t (missing_col);
	`>
	>[0]
>
type _ApplyIndexBadCol = Expect<
	Matches<ApplyIndexBadCol, SqlParserError<`Unknown column "missing_col" in CREATE INDEX`>>
>

type ParseInsertSelectIgnorable = ParseSqlStatementsRecovering<
	ParseSqlTokens<`
	create schema app;
	create table app.t (id int not null);
	insert into app.t (id) select 1;
`>
>
type _ParseInsertSelectIgnorable = Expect<
	Matches<
		ParseInsertSelectIgnorable,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "app"; readonly ifNotExists: false },
				{
					readonly kind: "create_table"
					readonly name: readonly ["t", "app"]
					readonly row: { id: number }
					readonly refs: undefined
				},
				{ readonly kind: "ignorable" },
			],
			EmptyTokenList,
		]
	>
>

type ParsedInsertChain = ParseSqlStatements<
	ParseSqlTokens<`create schema app; create table app.t (id int not null, label text not null); insert into app.t (id, label) values (1, 'a');`>
>
type ParsedInsertChainHead = ParsedInsertChain[0]
type ParsedLen = ParsedInsertChainHead extends readonly unknown[] ? ParsedInsertChainHead["length"] : 0
type _ParsedInsertChainHeadLen3 = Expect<Matches<ParsedLen, 3>>
type ThirdParsedStmt = ParsedInsertChainHead extends readonly [unknown, unknown, infer S3] ? S3 : never
type ThirdStmtKind = ThirdParsedStmt extends { readonly kind: infer K } ? K : "none"
type _Stmt2KindInsert = Expect<Matches<ThirdStmtKind, "insert_values">>
type _Stmt2ColumnsOrder = Expect<
	Matches<ThirdParsedStmt extends { readonly columns: infer C } ? C : never, readonly ["id", "label"]>
>
type ApplyAfterCreateTableOnly = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatements<
		ParseSqlTokens<`create schema app; create table app.t (id int not null, label text not null);`>
	>[0]
>

type ApplyInsertOk = SqlApplyStatements<SqlDatabase<"app">, ParsedInsertChain[0]>
type _ApplyInsertOkRow = Expect<
	Matches<ApplyInsertOk["schemas"]["app"]["t"], { readonly id: number; readonly label: string }>
>

type ApplyInsertWrongType = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null);
		insert into app.t (nope) values (1);
	`>
	>[0]
>
type _ApplyInsertWrongType = Expect<Matches<ApplyInsertWrongType, SqlParserError<`Unknown column "nope" in INSERT`>>>

type ParseAlterOnlyPk = ParseSqlStatements<ParseSqlTokens<`alter table app.u add constraint u_pkey primary key (id);`>>
type PkAlterStmt = ParseAlterOnlyPk[0] extends readonly [infer H] ? H : never
type _PkAlterStmtKind = Expect<Matches<PkAlterStmt extends { readonly kind: infer K } ? K : never, "alter_table">>
type _PkAlterPrimary = Expect<
	Matches<
		PkAlterStmt extends { readonly action: infer A } ? A : never,
		{ readonly kind: "add_constraint_primary"; readonly columns: readonly ["id"] }
	>
>

type ParseAlterDropConstraintOnly = ParseSqlStatements<
	ParseSqlTokens<`alter table app.u drop constraint if exists u_email_key;`>
>
type DropAlterStmt = ParseAlterDropConstraintOnly[0] extends readonly [infer H] ? H : never
type _DropAlterStmtKind = Expect<Matches<DropAlterStmt extends { readonly kind: infer K } ? K : never, "alter_table">>
type _DropAlterAction = Expect<
	Matches<
		DropAlterStmt extends { readonly action: infer A } ? A : never,
		{ readonly kind: "drop_constraint"; readonly ifExists: true; readonly name: "u_email_key" }
	>
>

type ParseAlterRlsIgnorable = ParseSqlStatementsRecovering<
	ParseSqlTokens<`
	create schema app;
	create table app.u (id int not null);
	alter table app.u enable row level security;
`>
>
type _ParseAlterRlsIgnorable = Expect<
	Matches<
		ParseAlterRlsIgnorable,
		[
			readonly [
				{ readonly kind: "create_schema"; readonly name: "app"; readonly ifNotExists: false },
				{
					readonly kind: "create_table"
					readonly name: readonly ["u", "app"]
					readonly row: { id: number }
					readonly refs: undefined
				},
				{ readonly kind: "ignorable" },
			],
			EmptyTokenList,
		]
	>
>

type ApplyCrossSchemaFkOk = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema auth;
		create table auth.users (id int not null);
		create schema app;
		create table app.members (uid int not null);
		alter table only app.members add constraint m_uid_fk foreign key (uid) references auth.users (id);
	`>
	>[0]
>
type _ApplyCrossSchemaFkOk = Expect<
	Matches<
		ApplyCrossSchemaFkOk,
		{
			readonly kind: "database"
			readonly defaultSchema: "app"
			readonly schemas: {
				auth: { users: { id: number } }
				app: { members: { uid: number } }
			}
		}
	>
>

type ApplyCrossSchemaFkMissingSchema = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema app;
		create table app.members (uid int not null);
		alter table app.members add constraint m_uid_fk foreign key (uid) references missing.users (id);
	`>
	>[0]
>
type _ApplyCrossSchemaFkMissingSchema = Expect<
	Matches<ApplyCrossSchemaFkMissingSchema, SqlParserError<`Unknown referenced schema "missing" in database`>>
>

type ApplyMixNoRowChange = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		comment on table app.t is 'note';
		create index t_id_idx on app.t (id);
		insert into app.t (id, label) values (2, 'b');
	`>
	>[0]
>

/** Same apply-depth as {@link ApplyMixNoRowChange}: two DDL statements + three identity statements. */
type ApplyMixBaselineSameDepth = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		comment on table app.t is 'note';
		create index t_id_idx on app.t (id);
		select 1;
	`>
	>[0]
>
type _ApplyMixNoRowChange = Expect<Matches<ApplyMixNoRowChange, ApplyMixBaselineSameDepth>>

describe("sql migration acceptance (type tests)", () => {
	it("should run", () => {})
})
