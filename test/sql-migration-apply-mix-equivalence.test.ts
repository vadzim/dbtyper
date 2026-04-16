/**
 * Migration DDL: ignorable statements do not change apply depth relative to a baseline with the same DDL + index count.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

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
	>[1]
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
	>[1]
>
type _ApplyMixNoRowChange = Expect<Matches<ApplyMixNoRowChange, ApplyMixBaselineSameDepth>>

describe("sql migration apply mix equivalence (type tests)", () => {
	it("should run", () => {})
})
