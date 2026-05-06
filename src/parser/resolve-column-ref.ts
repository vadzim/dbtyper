import type { JsqlDatabaseShape, JsqlTableShape } from "../core/jsql-shapes.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveTableShape } from "../core/jsql-utils-legacy.ts"
import type { HasAmbiguousUnqualifiedColumn, ScopeKeysWithColumn } from "./scope-unqualified-helpers.ts"

type GetColMeta3Shared<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, Col extends string> = [
	ResolveTableShape<Db, Sch, Tab>,
] extends [never]
	? SqlParserError<"Unknown schema or table">
	: ResolveTableShape<Db, Sch, Tab> extends infer Tbl extends JsqlTableShape
		? Col extends keyof Tbl["columns"]
			? {
					ts: Tbl["columns"][Col]
					sql: Tbl["columns"][Col]
				}
			: SqlParserError<"Unknown column (schema.table.column)">
		: SqlParserError<"Unknown schema or table">

type ValidateColumnPartsShared<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> = Parts extends readonly [infer S extends string, infer T extends string, infer C extends string]
	? GetColMeta3Shared<Db, S, T, C>
	: Parts extends readonly [infer A extends string, infer C extends string]
		? A extends keyof Scope
			? C extends keyof Scope[A]["columns"]
				? {
						ts: Scope[A]["columns"][C]
						sql: Scope[A]["columns"][C]
					}
				: SqlParserError<"Unknown qualified column">
			: SqlParserError<"Unknown qualified column">
		: Parts extends readonly [infer C0 extends string]
			? true extends HasAmbiguousUnqualifiedColumn<Scope, C0>
				? SqlParserError<"Ambiguous unqualified column">
				: ScopeKeysWithColumn<Scope, C0> extends infer U
					? [U] extends [never]
						? SqlParserError<"Unknown column">
						: U extends keyof Scope
							? C0 extends keyof Scope[U]["columns"]
								? {
										ts: Scope[U]["columns"][C0]
										sql: Scope[U]["columns"][C0]
									}
								: never
							: never
					: never
			: never

/**
 * Resolve a maximal ident chain (`col`, `alias.col`, `sch.tab.col`) to `{ ts, sql }` or an error.
 * Used by the expression parser and by SELECT projection resolution.
 */
export type ResolveColumnRefValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> = ValidateColumnPartsShared<Db, Scope, Parts>
