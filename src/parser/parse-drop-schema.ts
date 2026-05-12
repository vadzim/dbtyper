import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetSchema, JsqlDbReplaceSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { FormatError } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"

export type ParseDropSchema<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"exists">
				? SkipToken<A0> extends infer A1 extends TokensList
					? ParseDropSchemaName<A1, Db, true>
					: never
				: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_EXISTS_AFTER_IF_IN_DROP_SCHEMA", []>>
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
						FormatError<"SCHEMA_DOES_NOT_EXIST_USE_IF_EXISTS", []>
					> extends [infer Rest extends TokensList, infer Err]
					? [Rest, Db, Err]
					: never
				: SchemaName extends keyof Db["schemas"]
					? JsqlDbReplaceSchema<Db, SchemaName, null> extends infer NewDb extends JsqlDatabaseShape
						? [SkipToken<AfterName>, NewDb, null]
						: never
					: never
		: SkipFailedStatement<AfterName, Db, FormatError<"EXPECTED_SEMICOLON", ["DROP SCHEMA"]>>

type ParseDropSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterName extends TokensList
			? NameTok extends TokenIdent<infer SchemaName extends string>
				? ParseDropSchemaAfterIdent<AfterName, Db, IfExists, SchemaName>
				: SkipFailedStatement<AfterName, Db, FormatError<"EXPECTED_SCHEMA_NAME_IN_DROP_SCHEMA", []>>
			: never
		: never
