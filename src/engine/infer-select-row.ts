import type {
	ColRef,
	FromClause,
	JoinClause,
	OrderByItem,
	SelectColumn,
	SelectStatement,
	WhereAtom,
	WhereEq,
	WhereConjunction,
} from "../parser/parse-select.ts"
import type { SqlQualifiedIdentifier } from "../parser/sql-primitives.ts"
import type { JsqlSchemaShape, JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.ts"

export type VisibleEntry = {
	alias: string
	schema: string
	table: string
	columns: Record<string, unknown>
}

type TableAliasFromQI<Qi extends SqlQualifiedIdentifier> = Qi extends [infer N extends string]
	? N
	: Qi extends [infer N extends string, string]
		? N
		: never

type AddOneTable<
	Db extends JsqlDatabaseShape,
	Qi extends SqlQualifiedIdentifier,
	Acc extends readonly VisibleEntry[],
> = ResolveQualifiedIdentifier<Qi, Db["defaultSchema"]> extends [infer Schema extends string, infer Table extends string]
	? Db["schemas"] extends Record<string, JsqlSchemaShape>
		? SchemaExists<Extract<Db["schemas"], Record<string, JsqlSchemaShape>>, Schema> extends true
			? TableExists<Db["schemas"], Schema, Table> extends true
				? [
						...Acc,
						{
							alias: TableAliasFromQI<Qi>
							schema: Schema
							table: Table
							columns: Extract<Db["schemas"][Schema]["tables"][Table]["columns"], Record<string, unknown>>
						},
					]
				: SqlParserError<`Unknown table for SELECT: "${Schema}.${Table}"`>
			: SqlParserError<`Unknown schema for SELECT: "${Schema}"`>
		: SqlParserError<"Internal SELECT schema shape error">
	: SqlParserError<"Internal SELECT FROM resolution error">

type BuildVisibleTables<Db extends JsqlDatabaseShape, From extends FromClause> = AddOneTable<
	Db,
	From["primary"],
	[]
> extends infer Acc
	? Acc extends SqlParserError<string>
		? Acc
		: Acc extends readonly VisibleEntry[]
			? JoinTablesFold<Db, Acc, From["joins"]>
			: SqlParserError<"Internal SELECT visible tables">
	: SqlParserError<"Internal SELECT visible tables">

type JoinTablesFold<
	Db extends JsqlDatabaseShape,
	Acc extends readonly VisibleEntry[],
	Joins extends readonly JoinClause[],
> = Joins extends readonly [infer J extends JoinClause, ...infer Rest extends readonly JoinClause[]]
	? AddOneTable<Db, J["table"], Acc> extends infer Acc2
		? Acc2 extends SqlParserError<string>
			? Acc2
			: Acc2 extends readonly VisibleEntry[]
				? JoinTablesFold<Db, Acc2, Rest>
				: SqlParserError<"Internal SELECT join fold">
		: SqlParserError<"Internal SELECT join fold">
	: Acc

type ValidateColRef<Visible extends readonly VisibleEntry[], Ref extends ColRef> = Ref["table"] extends string
	? FindTableByAlias<Visible, Ref["table"]> extends infer E
		? E extends SqlParserError<string>
			? E
			: E extends VisibleEntry
				? Ref["column"] extends keyof E["columns"]
					? true
					: SqlParserError<`Unknown column "${Ref["column"] & string}" in WHERE or ORDER BY`>
				: SqlParserError<`Unknown table alias "${Ref["table"] & string}" in WHERE or ORDER BY`>
		: SqlParserError<`Unknown table alias "${Ref["table"] & string}" in WHERE or ORDER BY`>
	: CountColumnMatches<Visible, Ref["column"]> extends infer C
		? C extends 0
			? SqlParserError<`Unknown column "${Ref["column"] & string}" in WHERE or ORDER BY`>
			: C extends 1
				? true
				: SqlParserError<`Ambiguous column "${Ref["column"] & string}" in WHERE or ORDER BY`>
		: SqlParserError<"Internal column match count">

type FindTableByAlias<
	Visible extends readonly VisibleEntry[],
	Alias extends string,
> = Visible extends readonly [infer H extends VisibleEntry, ...infer T extends readonly VisibleEntry[]]
	? H["alias"] extends Alias
		? H
		: T extends readonly []
			? SqlParserError<`Unknown table alias "${Alias}" in WHERE or ORDER BY`>
			: FindTableByAlias<T, Alias>
	: SqlParserError<`Unknown table alias "${Alias}" in WHERE or ORDER BY`>

type CountColumnMatches<
	Visible extends readonly VisibleEntry[],
	Col extends string,
	Acc extends readonly 0[] = [],
> = Visible extends readonly [infer H extends VisibleEntry, ...infer T extends readonly VisibleEntry[]]
	? Col extends keyof H["columns"]
		? CountColumnMatches<T, Col, [...Acc, 0]>
		: CountColumnMatches<T, Col, Acc>
	: Acc["length"]

type ValidateWhereAtom<Visible extends readonly VisibleEntry[], A extends WhereAtom> = A extends {
	kind: "col"
	ref: infer R extends ColRef
}
	? ValidateColRef<Visible, R>
	: A extends { kind: "lit" }
		? true
		: SqlParserError<"Internal WHERE atom">

type ValidateWhereEq<Visible extends readonly VisibleEntry[], E extends WhereEq> = ValidateWhereAtom<
	Visible,
	E["left"]
> extends infer Lr
	? Lr extends SqlParserError<string>
		? Lr
		: ValidateWhereAtom<Visible, E["right"]> extends infer Rr
			? Rr extends SqlParserError<string>
				? Rr
				: true
			: SqlParserError<"Internal WHERE right atom">
		: SqlParserError<"Internal WHERE left atom">

type ValidateWhereConjunction<Visible extends readonly VisibleEntry[], W extends WhereConjunction> = W extends readonly [
	infer H extends WhereEq,
	...infer T extends readonly WhereEq[],
]
	? ValidateWhereEq<Visible, H> extends infer V
		? V extends SqlParserError<string>
			? V
			: ValidateWhereConjunction<Visible, T>
		: SqlParserError<"Internal WHERE conjunction">
	: true

type ValidateJoinOns<Visible extends readonly VisibleEntry[], Joins extends readonly JoinClause[]> = Joins extends readonly [
	infer J extends JoinClause,
	...infer Rest extends readonly JoinClause[],
]
	? ValidateWhereConjunction<Visible, J["on"]> extends infer V
		? V extends SqlParserError<string>
			? V
			: ValidateJoinOns<Visible, Rest>
		: SqlParserError<"Internal JOIN ON validation">
	: true

type ValidateOrderByList<Visible extends readonly VisibleEntry[], Items extends readonly OrderByItem[]> = Items extends readonly [
	infer H extends OrderByItem,
	...infer T extends readonly OrderByItem[],
]
	? ValidateColRef<Visible, H["ref"]> extends infer V
		? V extends SqlParserError<string>
			? V
			: ValidateOrderByList<Visible, T>
		: SqlParserError<"Internal ORDER BY validation">
	: true

type ValidateClauses<Stmt extends SelectStatement, Visible extends readonly VisibleEntry[]> =
	ValidateJoinOns<Visible, Stmt["from"]["joins"]> extends infer V1
		? V1 extends SqlParserError<string>
			? V1
			: Stmt extends { where: infer W extends WhereConjunction }
				? ValidateWhereConjunction<Visible, W> extends infer V2
					? V2 extends SqlParserError<string>
						? V2
						: Stmt extends { orderBy: infer O extends readonly OrderByItem[] }
							? ValidateOrderByList<Visible, O>
							: true
					: SqlParserError<"Internal WHERE validation">
				: Stmt extends { orderBy: infer O extends readonly OrderByItem[] }
					? ValidateOrderByList<Visible, O>
					: true
		: SqlParserError<"Internal JOIN ON validation">

type ResolveProjectionColumn<
	Visible extends readonly VisibleEntry[],
	Name extends string,
> = CountColumnMatches<Visible, Name> extends infer C
	? C extends 0
		? SqlParserError<`Unknown column "${Name}" in SELECT`>
		: C extends 1
			? SingleColumnType<Visible, Name>
			: SqlParserError<`Ambiguous column "${Name}" in SELECT`>
	: SqlParserError<"Internal projection column">

type SingleColumnType<
	Visible extends readonly VisibleEntry[],
	Col extends string,
> = Visible extends readonly [infer H extends VisibleEntry, ...infer T extends readonly VisibleEntry[]]
	? Col extends keyof H["columns"]
		? H["columns"][Col]
		: SingleColumnType<T, Col>
	: never

type BuildProjectionRow<
	Visible extends readonly VisibleEntry[],
	Columns extends readonly SelectColumn[],
	Seen extends string = never,
> = Columns extends readonly [infer H extends SelectColumn, ...infer T extends readonly SelectColumn[]]
	? H extends { name: infer N extends string; as?: infer A extends string | undefined }
		? ResolveProjectionColumn<Visible, N> extends infer Ty
			? Ty extends SqlParserError<string>
				? Ty
				: (H extends { as: infer Out extends string } ? Out : N) extends infer Key extends string
					? Key extends Seen
						? SqlParserError<"Duplicate SELECT output column">
						: BuildProjectionRow<Visible, T, Seen | Key> extends infer Sub
							? Sub extends SqlParserError<string>
								? Sub
								: Sub extends Record<string, unknown>
									? { [K in Key]: Ty } & Sub
									: SqlParserError<"Internal SELECT projection row">
							: never
					: SqlParserError<"Internal SELECT output key">
			: SqlParserError<"Internal projection">
		: never
	: {}

type SelectRowAfterValidate<Stmt extends SelectStatement, Visible extends readonly VisibleEntry[], Vc> = Vc extends SqlParserError<string>
	? Vc
	: Stmt["columns"] extends "star"
		? Stmt["from"]["joins"] extends readonly []
			? Visible["length"] extends 1
				? Visible extends readonly [infer First extends VisibleEntry, ...infer _]
					? First["columns"]
					: SqlParserError<"Internal SELECT star columns">
				: SqlParserError<"Internal SELECT single-table star">
			: SqlParserError<"SELECT * with JOIN is not supported for row typing; list columns explicitly">
		: Stmt["columns"] extends readonly SelectColumn[]
			? BuildProjectionRow<Visible, Stmt["columns"]>
			: SqlParserError<"Internal SELECT columns shape">

/** Row type emitted for `Stmt` when `Db` has the `FROM` table, or a parse-time error. */
export type SelectRow<Db extends JsqlDatabaseShape, Stmt extends SelectStatement> = BuildVisibleTables<
	Db,
	Stmt["from"]
> extends infer Visible
	? Visible extends SqlParserError<string>
		? Visible
		: Visible extends readonly VisibleEntry[]
			? ValidateClauses<Stmt, Visible> extends infer Vc
				? SelectRowAfterValidate<Stmt, Visible, Vc>
				: SqlParserError<"Internal clause validation">
			: SqlParserError<"Internal SELECT visible tables">
	: SqlParserError<"Internal SelectRow BuildVisibleTables">
