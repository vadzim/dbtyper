import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type { MergeDbPreserveScalars } from "../../core/sql-scalar-types.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"

export type ParseCreateSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateSchemaName<A2, Db, true>
							: never
						: [A1, Db, SqlParserError<"Expected `exists` after `IF NOT` in CREATE SCHEMA">]
					: never
				: [A0, Db, SqlParserError<"Expected `not` after `IF` in CREATE SCHEMA">]
			: never
		: ParseCreateSchemaName<Tokens, Db, false>

/** New schema starts with empty `sets`; avoid `JsqlSchemaShape` here so `sets` does not pick up `{ [K: string]: JsqlTableShape }` (cleaner IDE types after migrations). */
type MergeSchema<Db extends JsqlDatabaseShape, Name extends string> = MergeDbPreserveScalars<
	Db,
	{
		defaultSchema: Db["defaultSchema"]
		schemas: Db["schemas"] & Record<Name, { sets: {} }>
	}
>

/** One `ReadToken` after schema name: must be `;` or end. */
type ParseCreateSchemaAfterSchemaName<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	SchemaName extends string,
	IfNotExists extends boolean,
> =
	ReadToken<AfterName> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? IfNotExists extends true
				? [SchemaName] extends [keyof Db["schemas"]]
					? [R1, Db, null]
					: [R1, MergeSchema<Db, SchemaName>, null]
				: [SchemaName] extends [keyof Db["schemas"]]
					? [R1, Db, SqlParserError<"Schema already exists; use IF NOT EXISTS">]
					: [R1, MergeSchema<Db, SchemaName>, null]
			: [R1, Db, SqlParserError<"Expected `;` after schema name in CREATE SCHEMA">]
		: never

type ParseCreateSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	ReadToken<Tokens> extends [infer AfterName extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer SchemaName extends string>
			? ParseCreateSchemaAfterSchemaName<AfterName, Db, SchemaName, IfNotExists>
			: [AfterName, Db, SqlParserError<"Expected schema name in CREATE SCHEMA">]
		: never
