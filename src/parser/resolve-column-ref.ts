import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { DbtyperError, FormatError, Errors } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { JsqlDbGetData, JsqlDbGetColumnType } from "../core/jsql-utils.ts"
import type { HasAmbiguousUnqualifiedColumn, NearestScopeKeysWithColumn } from "./scope-unqualified-helpers.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type GetColMeta3Shared<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, Col extends string> = [
	JsqlDbGetData<Db, Sch, Tab>,
] extends [never]
	? FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [`${Sch}.${Tab}`, ""]>
	: JsqlDbGetData<Db, Sch, Tab> extends JsqlDataShape
		? JsqlDbGetColumnType<Db, Sch, Tab, Col> extends infer ColType extends SqlTypeShape
			? {
					sql: ColType
				}
			: FormatError<Errors["UNKNOWN_COLUMN_SCHEMA_TABLE_COLUMN"], [Sch, Tab, Col]>
		: FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [`${Sch}.${Tab}`, ""]>

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
						sql: Scope[A]["columns"][C]
					}
				: FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [A, C]>
			: FormatError<Errors["UNKNOWN_QUALIFIED_COLUMN"], [A, C]>
		: Parts extends readonly [infer C0 extends string]
			? true extends HasAmbiguousUnqualifiedColumn<Scope, C0>
				? FormatError<Errors["AMBIGUOUS_UNQUALIFIED_COLUMN"], [C0]>
				: NearestScopeKeysWithColumn<Scope, C0> extends infer U
					? [U] extends [never]
						? UnknownColumnNoClause<C0>
						: U extends keyof Scope
							? C0 extends keyof Scope[U]["columns"]
								? {
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

/**
 * ERR-8: the "Unknown column" error before a clause is named (no dangling " in "). It has the code of UNKNOWN_COLUMN
 * but no registry entry of its own: two entries with one code would fail the duplicate check in dbtyper-error.ts.
 * `WithErrorClause` below rewrites it into the full UNKNOWN_COLUMN message.
 */
type UnknownColumnNoClause<Col extends string> = DbtyperError<Errors["UNKNOWN_COLUMN"]["code"], `Unknown column ${Col}`>

/** ERR-8: name the clause in an "Unknown column" error that does not carry one yet. */
export type WithErrorClause<E, Clause extends string> =
	E extends DbtyperError<Errors["UNKNOWN_COLUMN"]["code"], infer M extends string>
		? M extends `Unknown column ${infer C}`
			? C extends `${string} in ${string}`
				? E
				: FormatError<Errors["UNKNOWN_COLUMN"], [C, Clause]>
			: E
		: E
