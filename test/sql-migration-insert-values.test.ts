/**
 * Migration DDL: INSERT VALUES shape, apply against schema, INSERT…SELECT as ignorable, column errors.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements, ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError, TokenKey } from "../core/sql-tokens.ts"
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
					token: TokenKey<";">
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
type ThirdParsedValueRows = ThirdParsedStmt extends { valueTypes: infer V extends unknown[][] } ? V : never
type _Stmt2ValuesSingleRowCount = Expect<Matches<ThirdParsedValueRows["length"], 1>>
type _Stmt2ValuesSingleRowLen = Expect<Matches<ThirdParsedValueRows[0]["length"], 2>>

type ParseInsertMultiRow = ParseSqlStatements<
	ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		insert into app.t (id, label) values (1, 'a'), (2, 'b');
	`>
>
type ParseInsertMultiRowStmt = ParseInsertMultiRow[1] extends [unknown, unknown, infer S3] ? S3 : never
type _ParseInsertMultiRowStmtKind = Expect<
	Matches<ParseInsertMultiRowStmt extends { kind: infer K } ? K : never, "insert_values">
>
type ParseInsertMultiRowValueRows = ParseInsertMultiRowStmt extends { valueTypes: infer V extends unknown[][] }
	? V
	: never
type _ParseInsertMultiRowValuesCount = Expect<Matches<ParseInsertMultiRowValueRows["length"], 2>>
type _ParseInsertMultiRowValuesFirstRowLen = Expect<Matches<ParseInsertMultiRowValueRows[0]["length"], 2>>
type _ParseInsertMultiRowValuesSecondRowLen = Expect<Matches<ParseInsertMultiRowValueRows[1]["length"], 2>>

type ParseInsertMultiRowMismatched = ParseSqlStatements<
	ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		insert into app.t (id, label) values (1, 'a'), (2);
	`>
>
type _ParseInsertMultiRowMismatched = Expect<
	Matches<ParseInsertMultiRowMismatched[1], SqlParserError<"INSERT column count does not match value count">>
>

type ApplyInsertOk = SqlApplyStatements<SqlDatabase<"app">, ParsedInsertChain[1]>
type _ApplyInsertOkRow = Expect<
	Matches<ApplyInsertOk["schemas"]["app"]["tables"]["t"]["columns"], { id: number; label: string }>
>

type ApplyInsertMultiRowOk = SqlApplyStatements<SqlDatabase<"app">, ParseInsertMultiRow[1]>
type _ApplyInsertMultiRowOkRow = Expect<
	Matches<ApplyInsertMultiRowOk["schemas"]["app"]["tables"]["t"]["columns"], { id: number; label: string }>
>

type ParseInsertDefaultValue = ParseSqlStatements<
	ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		insert into app.t (id, label) values (default, 'a');
	`>
>
type ParseInsertDefaultValueStmt = ParseInsertDefaultValue[1] extends [unknown, unknown, infer S3] ? S3 : never
type _ParseInsertDefaultValueStmtKind = Expect<
	Matches<ParseInsertDefaultValueStmt extends { kind: infer K } ? K : never, "insert_values">
>
type ParseInsertDefaultRows = ParseInsertDefaultValueStmt extends { valueTypes: infer V extends unknown[][] }
	? V
	: never
type _ParseInsertDefaultRowsCount = Expect<Matches<ParseInsertDefaultRows["length"], 1>>
type _ParseInsertDefaultRowLen = Expect<Matches<ParseInsertDefaultRows[0]["length"], 2>>

type ApplyInsertDefaultValueOk = SqlApplyStatements<SqlDatabase<"app">, ParseInsertDefaultValue[1]>
type _ApplyInsertDefaultValueOkRow = Expect<
	Matches<ApplyInsertDefaultValueOk["schemas"]["app"]["tables"]["t"]["columns"], { id: number; label: string }>
>

type ParseInsertExtendedLiterals = ParseSqlStatements<
	ParseSqlTokens<`
		create schema app;
		create table app.literal_features (
			a int not null,
			b int not null,
			c numeric not null,
			d numeric not null,
			e numeric not null,
			f int not null,
			g timestamp not null,
			h date not null,
			i time not null,
			j timestamptz not null
		);
		insert into app.literal_features (a, b, c, d, e, f, g, h, i, j) values ((1), +2, 3.5, -4.5, +5.5, -6, current_timestamp, current_date, current_time, now());
	`>
>
type ParseInsertExtendedLiteralsStmt = ParseInsertExtendedLiterals[1] extends [unknown, unknown, infer S3] ? S3 : never
type _ParseInsertExtendedLiteralsKind = Expect<
	Matches<ParseInsertExtendedLiteralsStmt extends { kind: infer K } ? K : never, "insert_values">
>
type ParseInsertExtendedLiteralsRows = ParseInsertExtendedLiteralsStmt extends {
	valueTypes: infer V extends unknown[][]
}
	? V
	: never
type _ParseInsertExtendedLiteralsRowCount = Expect<Matches<ParseInsertExtendedLiteralsRows["length"], 1>>
type _ParseInsertExtendedLiteralsValueCount = Expect<Matches<ParseInsertExtendedLiteralsRows[0]["length"], 10>>

type ParseInsertNamedParams = ParseSqlStatements<
	ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null, label text not null);
		insert into app.t (id, label) values (:rid, :lbl);
	`>
>
type ParseInsertNamedParamsStmt = ParseInsertNamedParams[1] extends [unknown, unknown, infer S3] ? S3 : never
type _ParseInsertNamedParamsKind = Expect<
	Matches<ParseInsertNamedParamsStmt extends { kind: infer K } ? K : never, "insert_values">
>
type InsertNamedParamsQP = ParseInsertNamedParamsStmt extends {
	queryParams: infer Q
}
	? Q
	: never
type _ParseInsertNamedParamsQP = Expect<
	Matches<
		InsertNamedParamsQP,
		{
			rid: { kind: "insert_value"; column: "id" }
			lbl: { kind: "insert_value"; column: "label" }
		}
	>
>

type ApplyInsertExtendedLiteralsOk = SqlApplyStatements<SqlDatabase<"app">, ParseInsertExtendedLiterals[1]>
type _ApplyInsertExtendedLiteralsOkRow = Expect<
	Matches<
		ApplyInsertExtendedLiteralsOk["schemas"]["app"]["tables"]["literal_features"]["columns"],
		{
			a: number
			b: number
			c: number
			d: number
			e: number
			f: number
			g: Date
			h: Date
			i: Date
			j: Date
		}
	>
>

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
