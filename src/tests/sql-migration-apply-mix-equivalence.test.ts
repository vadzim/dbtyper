/**
 * Migration DDL: ignorable statements do not change apply depth relative to a baseline with the same DDL + index count.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatements } from "../parser/sql-parse-statement.js"
import type { ParseSqlTokens } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

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

describe("sql migration apply mix equivalence (type tests)", () => {
	it("should run", () => {})
})
