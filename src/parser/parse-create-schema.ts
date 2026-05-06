import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { MergeSchemaIntoDb } from "../core/jsql-utils-legacy.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"

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

/** One token after schema name: must be `;` or end. */
type ParseCreateSchemaAfterSchemaName<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	SchemaName extends string,
	IfNotExists extends boolean,
> =
	PeekToken<AfterName> extends infer Tok
		? SkipToken<AfterName> extends infer R1 extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? IfNotExists extends true
					? [SchemaName] extends [keyof Db["schemas"]]
						? [R1, Db, null]
						: [R1, MergeSchemaIntoDb<Db, SchemaName>, null]
					: [SchemaName] extends [keyof Db["schemas"]]
						? [R1, Db, SqlParserError<"Schema already exists; use IF NOT EXISTS">]
						: [R1, MergeSchemaIntoDb<Db, SchemaName>, null]
				: [R1, Db, SqlParserError<"Expected `;` after schema name in CREATE SCHEMA">]
			: never
		: never

type ParseCreateSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterName extends TokensList
			? NameTok extends TokenIdent<infer SchemaName extends string>
				? ParseCreateSchemaAfterSchemaName<AfterName, Db, SchemaName, IfNotExists>
				: [AfterName, Db, SqlParserError<"Expected schema name in CREATE SCHEMA">]
			: never
		: never
