import type { JsqlDatabaseShape, JsqlSchemaShape } from "../../core/jsql-shapes.ts"
import type {
	ReadToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"

export type ParseCreateSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterIf extends TokensList, TokenKey<"if">]
		? ReadToken<AfterIf> extends [infer AfterNot extends TokensList, TokenKey<"not">]
			? ReadToken<AfterNot> extends [infer AfterExists extends TokensList, TokenKey<"exists">]
				? ParseCreateSchemaName<AfterExists, Db, true>
				: [AfterNot, Db, SqlParserError<"Expected `exists` after `IF NOT` in CREATE SCHEMA">]
			: [AfterIf, Db, SqlParserError<"Expected `not` after `IF` in CREATE SCHEMA">]
		: ParseCreateSchemaName<Tokens, Db, false>

type MergeSchema<Db extends JsqlDatabaseShape, Name extends string> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Db["schemas"] & Record<Name, JsqlSchemaShape>
}

type ParseCreateSchemaName<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
> =
	ReadToken<Tokens> extends [infer AfterName extends TokensList, TokenIdent<infer SchemaName extends string>]
		? ReadToken<AfterName> extends [infer AfterSemicolon extends TokensList, TokenKey<";"> | TokenEot]
			? IfNotExists extends true
				? [SchemaName] extends [keyof Db["schemas"]]
					? [AfterSemicolon, Db, null]
					: [AfterSemicolon, MergeSchema<Db, SchemaName>, null]
				: [SchemaName] extends [keyof Db["schemas"]]
					? [AfterSemicolon, Db, SqlParserError<"Schema already exists; use IF NOT EXISTS">]
					: [AfterSemicolon, MergeSchema<Db, SchemaName>, null]
			: [AfterName, Db, SqlParserError<"Expected `;` after schema name in CREATE SCHEMA">]
		: [Tokens, Db, SqlParserError<"Expected schema name in CREATE SCHEMA">]
