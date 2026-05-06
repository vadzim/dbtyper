import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlGetSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"

export type ParseDropSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropSchemaName<A1, Db, true>
					: never
				: [A0, Db, SqlParserError<"Expected `exists` after `IF` in DROP SCHEMA">]
			: never
		: ParseDropSchemaName<Tokens, Db, false>

type ParseDropSchemaAfterIdent<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	IfExists extends boolean,
	SchemaName extends string,
> =
	PeekToken<AfterName> extends infer Tok
		? SkipToken<AfterName> extends infer R1 extends TokensList
			? Tok extends TokenKey<";"> | TokenEot
				? IfExists extends true
					? JsqlGetSchema<Db, SchemaName> extends null
						? [R1, Db, null]
						: SchemaName extends keyof Db["schemas"]
							? RemoveSchemaFromDb<Db, SchemaName & keyof Db["schemas"]> extends infer NewDb extends
									JsqlDatabaseShape
								? [R1, NewDb, null]
								: never
							: never
					: JsqlGetSchema<Db, SchemaName> extends null
						? [R1, Db, SqlParserError<"Schema does not exist; use IF EXISTS">]
						: SchemaName extends keyof Db["schemas"]
							? RemoveSchemaFromDb<Db, SchemaName & keyof Db["schemas"]> extends infer NewDb extends
									JsqlDatabaseShape
								? [R1, NewDb, null]
								: never
							: never
				: [R1, Db, SqlParserError<"Expected `;` after DROP SCHEMA">]
			: never
		: never

type ParseDropSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterName extends TokensList
			? NameTok extends TokenIdent<infer SchemaName extends string>
				? ParseDropSchemaAfterIdent<AfterName, Db, IfExists, SchemaName>
				: [AfterName, Db, SqlParserError<"Expected schema name in DROP SCHEMA">]
			: never
		: never

type RemoveSchemaFromDb<Db extends JsqlDatabaseShape, Sch extends keyof Db["schemas"]> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Omit<Db["schemas"], Sch>
}
