import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbReplaceSchema, JsqlCreateSchema } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { FormatError } from "../sql-parser-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"

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
									FormatError<"EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_SCHEMA", []>
							  > extends [infer Rest extends TokensList, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_NOT_AFTER_IF_IN_CREATE_SCHEMA", []>>
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
				? [AfterName, Db, FormatError<"SCHEMA_ALREADY_EXISTS_USE_IF_NOT_EXISTS", []>]
				: [SkipToken<AfterName>, JsqlDbReplaceSchema<Db, SchemaName, JsqlCreateSchema>, null]
		: SkipFailedStatement<AfterName, Db, FormatError<"EXPECTED_SEMICOLON", ["schema name in CREATE SCHEMA"]>>

type ParseCreateSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	PeekToken<Tokens> extends TokenIdent<infer SchemaName extends string>
		? ParseCreateSchemaAfterSchemaName<SkipToken<Tokens>, Db, SchemaName, IfNotExists>
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SCHEMA_NAME_IN_CREATE_SCHEMA", []>>
