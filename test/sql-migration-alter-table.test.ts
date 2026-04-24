/**
 * Migration DDL: ALTER TABLE constraint adds/drops and RLS-related statements as ignorable.
 */
import { describe, it } from "node:test"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, TokenType } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type ParseAlterOnlyPk = ParseSqlStatements<ParseSqlTokens<`alter table app.u add constraint u_pkey primary key (id);`>>
type PkAlterStmt = ParseAlterOnlyPk[1] extends [infer H] ? H : never
type _PkAlterStmtKind = Expect<Matches<PkAlterStmt extends { kind: infer K } ? K : never, "alter_table">>
type _PkAlterPrimary = Expect<
	Matches<PkAlterStmt extends { action: infer A } ? A : never, { kind: "add_constraint_primary"; columns: ["id"] }>
>

type ParseAlterDropConstraintOnly = ParseSqlStatements<
	ParseSqlTokens<`alter table app.u drop constraint if exists u_email_key;`>
>
type DropAlterStmt = ParseAlterDropConstraintOnly[1] extends [infer H] ? H : never
type _DropAlterStmtKind = Expect<Matches<DropAlterStmt extends { kind: infer K } ? K : never, "alter_table">>
type _DropAlterAction = Expect<
	Matches<
		DropAlterStmt extends { action: infer A } ? A : never,
		{ kind: "drop_constraint"; ifExists: true; name: "u_email_key" }
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
			EmptyTokenList,
			[
				{ kind: "create_schema"; name: "app"; ifNotExists: false },
				{
					kind: "create_table"
					name: ["u", "app"]
					row: { id: number }
					refs: undefined
					intraTableConstraints: []
				},
				{
					kind: "skipped-statement"
					token: TokenType<";">
				},
			],
		]
	>
>

describe("sql migration alter table (type tests)", () => {
	it("should run", () => {})
})
