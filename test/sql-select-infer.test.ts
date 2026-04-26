/**
 * `SelectRow` and `ApplySelect` against a small `JsqlDatabaseShape` value.
 */
import { describe, it } from "node:test"
import type { ApplySelect } from "../src/engine/apply-select.ts"
import type { SelectRow } from "../src/engine/infer-select-row.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { SqlApplyStatement } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type SmallDb = {
	defaultSchema: "public"
	schemas: {
		public: { tables: { t: { columns: { id: number; name: string } } } }
	}
}

type TwoTableDb = {
	defaultSchema: "public"
	schemas: {
		public: {
			tables: {
				users: { columns: { id: number; x: number; name: string } }
				orders: { columns: { uid: number; title: string } }
			}
		}
	}
}

/** Both joined tables define `id` so an unqualified `id` in SELECT is ambiguous. */
type AmbigJoinDb = {
	defaultSchema: "public"
	schemas: {
		public: {
			tables: {
				a: { columns: { id: number; only_a: string } }
				b: { columns: { id: number; only_b: string } }
			}
		}
	}
}

type StarStmt = ParseSqlStatements<ParseSqlTokens<"select * from t;">>[1][0]
type _SelectRowStar = Expect<Matches<SelectRow<SmallDb, StarStmt>, { id: number; name: string }>>

type IdNameStmt = ParseSqlStatements<ParseSqlTokens<"select id, name from t;">>[1][0]
type _SelectRowNamed = Expect<Matches<SelectRow<SmallDb, IdNameStmt>, { id: number; name: string }>>

type BadColStmt = ParseSqlStatements<ParseSqlTokens<"select nope from t;">>[1][0]
type _SelectRowBad = Expect<Matches<SelectRow<SmallDb, BadColStmt>, SqlParserError<`Unknown column "nope" in SELECT`>>>

type JoinProj = ParseSqlStatements<ParseSqlTokens<"select uid from users join orders on users.id = orders.uid;">>[1][0]
type _JoinRow = Expect<Matches<SelectRow<TwoTableDb, JoinProj>, { uid: number }>>

/** Two visible columns from two join tables; output keys = bare column names. */
type JoinTwoColsNoAs = ParseSqlStatements<
	ParseSqlTokens<"select x, uid, name, title from users join orders on users.id = orders.uid;">
>[1][0]
type _JoinTwoColsNoAs = Expect<
	Matches<
		SelectRow<TwoTableDb, JoinTwoColsNoAs>,
		{
			x: number
			uid: number
			name: string
			title: string
		}
	>
>

/** Same join, with `AS` aliases driving output keys. */
type JoinTwoColsWithAs = ParseSqlStatements<
	ParseSqlTokens<"select x as user_x, uid as order_uid, name as user_name, o.title as order_title from users join orders o on users.id = o.uid;">
>[1][0]
type _JoinTwoColsWithAs = Expect<
	Matches<
		SelectRow<TwoTableDb, JoinTwoColsWithAs>,
		{
			user_x: number
			order_uid: number
			user_name: string
			order_title: string
		}
	>
>

/** `JOIN` table with explicit `AS` and qualified `SELECT`; same as bare alias for typing. */
type JoinExplicitAsKeyword = ParseSqlStatements<
	ParseSqlTokens<"select o.title, users.name from users join orders as o on users.id = o.uid;">
>[1][0]
type _JoinExplicitAsKeyword = Expect<
	Matches<SelectRow<TwoTableDb, JoinExplicitAsKeyword>, { title: string; name: string }>
>

/** Primary `FROM` uses `AS`; `WHERE` / `ORDER BY` use the same alias `u.…`. */
type PrimaryTableAsAlias = ParseSqlStatements<
	ParseSqlTokens<"select u.name from users as u where u.x = 0 order by u.id;">
>[1][0]
type _PrimaryTableAsAlias = Expect<Matches<SelectRow<TwoTableDb, PrimaryTableAsAlias>, { name: string }>>

/** Default alias is the name segment (`users`); `users.id` works without a custom alias. */
type DefaultQiAliasInSelect = ParseSqlStatements<ParseSqlTokens<"select users.id from users;">>[1][0]
type _DefaultQiAliasInSelect = Expect<Matches<SelectRow<TwoTableDb, DefaultQiAliasInSelect>, { id: number }>>

type BarePrimaryAlias = ParseSqlStatements<ParseSqlTokens<"select u.id, u.name from t u;">>[1][0]
type _BarePrimaryAlias = Expect<Matches<SelectRow<SmallDb, BarePrimaryAlias>, { id: number; name: string }>>

type UnknownTableAliasInSelect = ParseSqlStatements<ParseSqlTokens<"select z.id from users;">>[1][0]
type _UnknownTableAliasInSelect = Expect<
	Matches<SelectRow<TwoTableDb, UnknownTableAliasInSelect>, SqlParserError<`Unknown table alias "z" in WHERE or ORDER BY`>>
>

type UnknownColQualified = ParseSqlStatements<
	ParseSqlTokens<"select o.nope from users join orders o on users.id = o.uid;">
>[1][0]
type _UnknownColQualified = Expect<
	Matches<SelectRow<TwoTableDb, UnknownColQualified>, SqlParserError<`Unknown column "nope" in SELECT`>>
>

type WhereOrderUseJoinAlias = ParseSqlStatements<
	ParseSqlTokens<"select o.uid as ou from users join orders o on users.id = o.uid where o.title = 'x' order by o.uid;">
>[1][0]
type _WhereOrderUseJoinAlias = Expect<Matches<SelectRow<TwoTableDb, WhereOrderUseJoinAlias>, { ou: number }>>

type AmbigUnqualId = ParseSqlStatements<ParseSqlTokens<"select id from a join b on a.id = b.id;">>[1][0]
type _AmbigUnqualId = Expect<
	Matches<SelectRow<AmbigJoinDb, AmbigUnqualId>, SqlParserError<`Ambiguous column "id" in SELECT`>>
>

/** Table-qualified `a.id` / `b.id` still project under column name `id` unless `AS` renames. */
type DisambigWithQualifiers = ParseSqlStatements<
	ParseSqlTokens<"select a.id as id_a, b.id as id_b, a.only_a from a join b on a.id = b.id;">
>[1][0]
type _DisambigWithQualifiers = Expect<
	Matches<SelectRow<AmbigJoinDb, DisambigWithQualifiers>, { id_a: number; id_b: number; only_a: string }>
>

/** Same output name twice in the list (unqualified, same key `id`). */
type DuplicateOutputColumn = ParseSqlStatements<ParseSqlTokens<"select id, id from t;">>[1][0]
type _DuplicateOutputColumn = Expect<Matches<SelectRow<SmallDb, DuplicateOutputColumn>, SqlParserError<"Duplicate SELECT output column">>>

/**
 * Two `table.id` items both map to the output name `id` (no `AS`); same duplicate error as
 * unqualified `id, id` on a single table.
 */
type DuplicateFromTwoQualifiers = ParseSqlStatements<
	ParseSqlTokens<"select a.id, b.id, a.only_a from a join b on a.id = b.id;">
>[1][0]
type _DuplicateFromTwoQualifiers = Expect<
	Matches<SelectRow<AmbigJoinDb, DuplicateFromTwoQualifiers>, SqlParserError<"Duplicate SELECT output column">>
>

type StarJoin = ParseSqlStatements<ParseSqlTokens<"select * from users join orders on users.id = orders.uid;">>[1][0]
type _StarJoinErr = Expect<
	Matches<
		SelectRow<TwoTableDb, StarJoin>,
		SqlParserError<"SELECT * with JOIN is not supported for row typing; list columns explicitly">
	>
>

type WhereOrderOk = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid where users.x = 1 order by orders.uid desc;">
>[1][0]
type _WhereOrderRow = Expect<Matches<SelectRow<TwoTableDb, WhereOrderOk>, { uid: number }>>

type BadWhere = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid where z = 1;">
>[1][0]
type _BadWhere = Expect<
	Matches<SelectRow<TwoTableDb, BadWhere>, SqlParserError<`Unknown column "z" in WHERE or ORDER BY`>>
>

type BadOrderBy = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid order by z;">
>[1][0]
type _BadOrderBy = Expect<
	Matches<SelectRow<TwoTableDb, BadOrderBy>, SqlParserError<`Unknown column "z" in WHERE or ORDER BY`>>
>

type AsAliasStmt = ParseSqlStatements<ParseSqlTokens<"select id as rid from t;">>[1][0]
type _AsAliasRow = Expect<Matches<SelectRow<SmallDb, AsAliasStmt>, { rid: number }>>

type LimitStmt = ParseSqlStatements<ParseSqlTokens<"select id from t limit 5 offset 1;">>[1][0]
type _LimitIgnoredRow = Expect<Matches<SelectRow<SmallDb, LimitStmt>, { id: number }>>

type _ApplyJoinOk = Expect<Matches<ApplySelect<TwoTableDb, JoinProj>, TwoTableDb>>

type _ApplyOk = Expect<Matches<SqlApplyStatement<SmallDb, StarStmt>, SmallDb>>
type _ApplyInvalid = Expect<Matches<SqlApplyStatement<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>
type _ApplySelectDirect = Expect<Matches<ApplySelect<SmallDb, StarStmt>, SmallDb>>
type _ApplySelectBad = Expect<Matches<ApplySelect<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>

describe("sql select infer/apply (type tests)", () => {
	it("should run", () => {})
})
