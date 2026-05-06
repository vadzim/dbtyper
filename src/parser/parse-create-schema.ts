import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbReplaceSchema, JsqlCreateSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

export type ParseCreateSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateSchemaName<A2, Db, true>
							: never
						: SkipFailedExpression<
									A1,
									SqlParserError<"Expected `exists` after `IF NOT` in CREATE SCHEMA">
							  > extends [infer Rest extends TokensList, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: SkipFailedExpression<A0, SqlParserError<"Expected `not` after `IF` in CREATE SCHEMA">> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
			: never
		: ParseCreateSchemaName<Tokens, Db, false>

/** One token after schema name: must be `;` or end. */
type ParseCreateSchemaAfterSchemaName<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	SchemaName extends string,
	IfNotExists extends boolean,
> =
	PeekToken<AfterName> extends TokenKey<";"> | TokenEot
		? IfNotExists extends true
			? [SchemaName] extends [keyof Db["schemas"]]
				? [SkipToken<AfterName>, Db, null]
				: [SkipToken<AfterName>, JsqlDbReplaceSchema<Db, SchemaName, JsqlCreateSchema>, null]
			: [SchemaName] extends [keyof Db["schemas"]]
				? [AfterName, Db, SqlParserError<"Schema already exists; use IF NOT EXISTS">]
				: [SkipToken<AfterName>, JsqlDbReplaceSchema<Db, SchemaName, JsqlCreateSchema>, null]
		: SkipFailedExpression<AfterName, SqlParserError<"Expected `;` after schema name in CREATE SCHEMA">> extends [
					infer Rest extends TokensList,
					infer Err,
			  ]
			? [Rest, Db, Err]
			: never

type ParseCreateSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	PeekToken<Tokens> extends TokenIdent<infer SchemaName extends string>
		? ParseCreateSchemaAfterSchemaName<SkipToken<Tokens>, Db, SchemaName, IfNotExists>
		: SkipFailedExpression<Tokens, SqlParserError<"Expected schema name in CREATE SCHEMA">> extends [
					infer Rest extends TokensList,
					infer Err,
			  ]
			? [Rest, Db, Err]
			: never
