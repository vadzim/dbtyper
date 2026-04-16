/**
 * Migration DDL: INSERT VALUES shape, apply against schema, INSERT…SELECT as ignorable, column errors.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

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
			EmptyTokenList,
			[
				{ kind: "create_schema"; name: "app"; ifNotExists: false },
				{
					kind: "create_table"
					name: ["t", "app"]
					row: { id: number }
					refs: undefined
					intraTableConstraints: []
				},
				{
					kind: "skipped-statement"
					token: ";"
				},
			],
		]
	>
>

type ParsedInsertChain = ParseSqlStatements<
	ParseSqlTokens<`create schema app; create table app.t (id int not null, label text not null); insert into app.t (id, label) values (1, 'a');`>
>
type ParsedInsertChainHead = ParsedInsertChain[1]
type ParsedLen = ParsedInsertChainHead extends unknown[] ? ParsedInsertChainHead["length"] : 0
type _ParsedInsertChainHeadLen3 = Expect<Matches<ParsedLen, 3>>
type ThirdParsedStmt = ParsedInsertChainHead extends [unknown, unknown, infer S3] ? S3 : never
type ThirdStmtKind = ThirdParsedStmt extends { kind: infer K } ? K : "none"
type _Stmt2KindInsert = Expect<Matches<ThirdStmtKind, "insert_values">>
type _Stmt2ColumnsOrder = Expect<Matches<ThirdParsedStmt extends { columns: infer C } ? C : never, ["id", "label"]>>

type ApplyInsertOk = SqlApplyStatements<SqlDatabase<"app">, ParsedInsertChain[1]>
type _ApplyInsertOkRow = Expect<Matches<ApplyInsertOk["schemas"]["app"]["t"], { id: number; label: string }>>

type ApplyInsertWrongType = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatements<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null);
		insert into app.t (nope) values (1);
	`>
	>[1]
>
type _ApplyInsertWrongType = Expect<Matches<ApplyInsertWrongType, SqlParserError<`Unknown column "nope" in INSERT`>>>

describe("sql migration insert values (type tests)", () => {
	it("should run", () => {})
})
