import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetSchema, JsqlDbReplaceSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

export type ParseDropSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropSchemaName<A1, Db, true>
					: never
				: SkipFailedExpression<A0, SqlParserError<"Expected `exists` after `IF` in DROP SCHEMA">> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
			: never
		: ParseDropSchemaName<Tokens, Db, false>

type ParseDropSchemaAfterIdent<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	IfExists extends boolean,
	SchemaName extends string,
> =
	PeekToken<AfterName> extends TokenKey<";"> | TokenEot
		? IfExists extends true
			? JsqlDbGetSchema<Db, SchemaName> extends null
				? [SkipToken<AfterName>, Db, null]
				: SchemaName extends keyof Db["schemas"]
					? JsqlDbReplaceSchema<Db, SchemaName, null> extends infer NewDb extends JsqlDatabaseShape
						? [SkipToken<AfterName>, NewDb, null]
						: never
					: never
			: JsqlDbGetSchema<Db, SchemaName> extends null
				? SkipFailedExpression<
						SkipToken<AfterName>,
						SqlParserError<"Schema does not exist; use IF EXISTS">
					> extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
				: SchemaName extends keyof Db["schemas"]
					? JsqlDbReplaceSchema<Db, SchemaName, null> extends infer NewDb extends JsqlDatabaseShape
						? [SkipToken<AfterName>, NewDb, null]
						: never
					: never
		: SkipFailedExpression<AfterName, SqlParserError<"Expected `;` after DROP SCHEMA">> extends [
					infer Rest extends TokensList,
					infer Err,
			  ]
			? [Rest, Db, Err]
			: never

type ParseDropSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterName extends TokensList
			? NameTok extends TokenIdent<infer SchemaName extends string>
				? ParseDropSchemaAfterIdent<AfterName, Db, IfExists, SchemaName>
				: SkipFailedExpression<AfterName, SqlParserError<"Expected schema name in DROP SCHEMA">> extends [
							infer Rest extends TokensList,
							infer Err,
					  ]
					? [Rest, Db, Err]
					: never
			: never
		: never
