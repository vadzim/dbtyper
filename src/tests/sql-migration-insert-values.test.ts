/**
 * Migration DDL: INSERT VALUES shape, apply against schema, INSERT…SELECT as ignorable, column errors.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../parser/parse-sql-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

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
				{ readonly kind: "skipped-statement" },
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

describe("sql migration insert values (type tests)", () => {
	it("should run", () => {})
})
