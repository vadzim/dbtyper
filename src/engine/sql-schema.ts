import type { FkColumnPair, ForeignRefMeta, ValidateFkReferencedColumnPairs } from "../parser/sql-constraints-fk.js"
import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"

/** One entry in `SqlSchema<[…]>`: a parsed table or a whole-table parse error from `SqlCreateTable`. */
type SqlSchemaTableInput = SqlCreateTableLike | SqlParseError<string>

type ValidateRefColumnPairs<Pairs extends readonly FkColumnPair[], TargetRow> =
	ValidateFkReferencedColumnPairs<Pairs, Extract<keyof TargetRow, string>> extends true
		? never
		: ValidateFkReferencedColumnPairs<Pairs, Extract<keyof TargetRow, string>>

type ValidateIntraSchemaRefs<Refs extends ForeignRefMeta, Tables> = Refs extends infer R
	? R extends ForeignRefMeta
		? R extends {
				columnPairs: infer Pairs extends readonly FkColumnPair[]
				toSchema: infer TS
				toTable: infer TT extends string
			}
			? [TS] extends [never]
				? TT extends keyof Tables
					? ValidateRefColumnPairs<Pairs, Tables[TT]>
					: SqlParseError<`Unknown referenced table "${TT}" in schema`>
				: never
			: never
		: never
	: never

type SqlSchemaBuildInternal<
	Tables extends readonly SqlSchemaTableInput[],
	Acc,
	Seen extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> = Tables extends readonly [infer Head, ...infer Tail extends readonly SqlSchemaTableInput[]]
	? Head extends SqlParseError<string>
		? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Head, Refs>
		: Head extends SqlCreateTableLike
			? Head["name"] extends infer Name
				? Name extends SqlParseError<string>
					? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Name, Refs>
					: Name extends string
						? Name extends Seen
							? SqlSchemaBuildInternal<
									Tail,
									Acc,
									Seen,
									Error | SqlParseError<`Duplicate table name: ${Name}`>,
									Refs
								>
							: Head["row"] extends infer Row
								? Row extends SqlParseError<string>
									? SqlSchemaBuildInternal<Tail, Acc, Seen | Name, Error | Row, Refs>
									: SqlSchemaBuildInternal<
											Tail,
											// Internal accumulator keeps table names literal while extending shape.
											Acc & { [K in Name]: Row },
											Seen | Name,
											Error,
											| Refs
											| (Head["__refs"] extends infer FR extends ForeignRefMeta
													? Omit<FR, "from"> & { from: Name }
													: never)
										>
								: SqlSchemaBuildInternal<
										Tail,
										Acc,
										Seen | Name,
										Error | SqlParseError<"Internal SQL parser error">,
										Refs
									>
						: SqlSchemaBuildInternal<
								Tail,
								Acc,
								Seen,
								Error | SqlParseError<"Expected a CREATE TABLE statement with a table name">,
								Refs
							>
				: SqlSchemaBuildInternal<
						Tail,
						Acc,
						Seen,
						Error | SqlParseError<"Expected a CREATE TABLE statement with a table name">,
						Refs
					>
			: SqlSchemaBuildInternal<Tail, Acc, Seen, Error | SqlParseError<"Invalid schema table entry">, Refs>
	: {
			// Inline mapped expansion is intentional for API/tooling: preserve expanded table map shape in schema tooltips.
			tables: { [K in keyof Acc]: Acc[K] }
			error: Error | ValidateIntraSchemaRefs<Refs, { [K in keyof Acc]: Acc[K] }>
			refs: Refs
		}

export type SqlSchema<Tables extends readonly SqlSchemaTableInput[]> =
	SqlSchemaBuildInternal<Tables, {}, never> extends infer Built
		? Built extends { tables: infer T; error: infer E; refs: infer R }
			? [E] extends [never]
				? {
						readonly kind: "schema"
						readonly tables: T
						readonly __refs: Extract<R, ForeignRefMeta>
					}
				: E
			: SqlParseError<"Internal schema builder error">
		: SqlParseError<"Internal schema builder error">
