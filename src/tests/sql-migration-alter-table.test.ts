/**
 * Migration DDL: ALTER TABLE constraint adds/drops and RLS-related statements as ignorable.
 */
import { describe, it } from "node:test"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

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
				{ readonly kind: "skipped-statement" },
			],
			EmptyTokenList,
		]
	>
>

describe("sql migration alter table (type tests)", () => {
	it("should run", () => {})
})
