import type { JsqlDatabaseShape, JsqlDataShape, JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { JsqlDbGetSchema, JsqlDbGetTable, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseNameList } from "./parse-table-constraints.ts"
import type { SkipParenGroup } from "./parse-column-constraints.ts"

/**
 * `REFERENCES [schema.]table [(column, …)] [MATCH …] [ON DELETE|UPDATE action …]` after the keyword (CORE-15).
 * The target must exist at this point of the chain, or be the table being created (CORE-17).
 * Result: `[rest, null]` or `[rest, error]`.
 */
export type ParseReferences<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? ReferencesTarget<SkipToken<R2>, Db, Schema, Table, A, B>
						: SkipFailedExpression<
								R2,
								FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in REFERENCES"]>
							>
					: never
				: ReferencesTarget<R1, Db, Schema, Table, UnqualifiedSchema<Db, A>, A>
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in REFERENCES"]>>

type ReferencesTarget<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	TSch extends string,
	TTab extends string,
> = [TSch, TTab] extends [Schema, Table]
	? ReferencesColumns<Tokens, Record<string, SqlTypeShape>, true>
	: JsqlDbGetSchema<Db, TSch> extends JsqlSchemaShape
		? JsqlDbGetTable<Db, TSch, TTab> extends infer T extends JsqlDataShape<"table">
			? ReferencesColumns<Tokens, T["columns"], false>
			: SkipFailedExpression<Tokens, FormatError<Errors["UNKNOWN_TABLE"], [TTab, "REFERENCES"]>>
		: SkipFailedExpression<Tokens, FormatError<Errors["UNKNOWN_SCHEMA"], [TSch, "REFERENCES"]>>

/** Optional `(col, …)` of the target (each must exist unless the target is the table itself), then the actions. */
type ReferencesColumns<
	Tokens extends ParserMonad,
	Columns extends Record<string, SqlTypeShape>,
	AnyColumn extends boolean,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseNameList<SkipToken<Tokens>, readonly []> extends [infer R extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R, Names]
				: Names extends readonly string[]
					? AnyColumn extends true
						? SkipReferenceActions<R>
						: Exclude<Names[number], keyof Columns> extends infer Missing extends string
							? [Missing] extends [never]
								? SkipReferenceActions<R>
								: SkipFailedExpression<
										R,
										FormatError<Errors["UNKNOWN_COLUMN"], [Missing, "REFERENCES"]>
									>
							: never
					: never
			: never
		: SkipReferenceActions<Tokens>

/** `ON DELETE|UPDATE action`, `MATCH x`, in any number and order. Result `[rest, null]`. */
type SkipReferenceActions<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"on">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"set">
					? ReferenceSetAction<SkipToken<R2>>
					: PeekToken<R2> extends TokenIdent<"no">
						? SkipToken<R2> extends infer R3 extends ParserMonad
							? SkipReferenceActions<SkipToken<R3>>
							: never
						: SkipReferenceActions<SkipToken<R2>>
				: never
			: never
		: PeekToken<Tokens> extends TokenIdent<"match">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? SkipReferenceActions<SkipToken<R1>>
				: never
			: [Tokens, null]

/** At the `NULL` or `DEFAULT` after `SET`: skip it, an optional column list, then the rest of the actions. */
type ReferenceSetAction<Tokens extends ParserMonad> =
	SkipToken<Tokens> extends infer R extends ParserMonad
		? PeekToken<R> extends TokenKey<"(">
			? SkipParenGroup<R> extends [infer R2 extends ParserMonad, infer _E]
				? SkipReferenceActions<R2>
				: never
			: SkipReferenceActions<R>
		: never
