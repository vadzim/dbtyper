import type { FkColumnPair, ForeignRefMeta, ValidateFkReferencedColumnPairs } from "../parser/sql-constraints-fk.js"
import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlQualifiedIdentifier } from "../parser/sql-parse-primitives.js"

export type SqlSchema<Tables extends readonly SqlSchemaTableInput[]> =
	SqlSchemaBuildInternal<Tables, {}, never> extends infer Built
		? Built extends { tables: infer T; error: infer E; refs: infer R }
			? [E] extends [never]
				? {
						readonly kind: "schema"
						readonly tables: T
						readonly __refs: [Extract<R, ForeignRefMeta>] extends [never]
							? undefined
							: Extract<R, ForeignRefMeta>
					}
				: E
			: SqlParseError<"Internal schema builder error">
		: SqlParseError<"Internal schema builder error">

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
			? [TS] extends [undefined]
				? TT extends keyof Tables
					? ValidateRefColumnPairs<Pairs, Tables[TT]>
					: SqlParseError<`Unknown referenced table "${TT}" in schema`>
				: never
			: never
		: never
	: never

type BuildDone<Acc, Error, Refs extends ForeignRefMeta> = {
	tables: Acc
	error: Error | ValidateIntraSchemaRefs<Refs, Acc>
	refs: Refs
}

type SqlSchemaBuildInternal<
	Tables extends readonly SqlSchemaTableInput[],
	Acc,
	Seen extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> = Tables extends readonly [infer Head, ...infer Tail extends readonly SqlSchemaTableInput[]]
	? [Head] extends [never]
		? SqlSchemaBuildInternal<Tail, Acc, Seen, Error, Refs>
		: Head extends SqlParseError<string>
			? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Head, Refs>
			: Head extends SqlCreateTableLike
				? Head["name"] extends infer Name
					? Name extends SqlParseError<string>
						? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Name, Refs>
						: Name extends SqlQualifiedIdentifier
							? Name[0] extends infer TableName extends string
								? TableName extends Seen
									? SqlSchemaBuildInternal<
											Tail,
											Acc,
											Seen,
											Error | SqlParseError<`Duplicate table name: ${TableName}`>,
											Refs
										>
									: Head["row"] extends infer Row
										? Row extends SqlParseError<string>
											? SqlSchemaBuildInternal<Tail, Acc, Seen | TableName, Error | Row, Refs>
											: SqlSchemaBuildInternal<
													Tail,
													Acc & { [K in TableName]: Row },
													Seen | TableName,
													Error,
													| Refs
													| (Head["__refs"] extends infer FR extends ForeignRefMeta
															? Omit<FR, "from"> & { from: TableName }
															: never)
												>
										: SqlSchemaBuildInternal<
												Tail,
												Acc,
												Seen | TableName,
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
					: SqlSchemaBuildInternal<
							Tail,
							Acc,
							Seen,
							Error | SqlParseError<"Expected a CREATE TABLE statement with a table name">,
							Refs
						>
				: SqlSchemaBuildInternal<Tail, Acc, Seen, Error | SqlParseError<"Invalid schema table entry">, Refs>
	: BuildDone<Acc, Error, Refs>
