import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
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

/** True when `Sch` is already a concrete key of `schemas` (not only an open-ended index signature). */
type HasConcreteSchema<Schemas extends object, Sch extends string> = string extends keyof Schemas
	? false
	: Sch extends keyof Schemas
		? true
		: false

type ParseDropSchemaAfterIdent<
	AfterName extends TokensList,
	Db extends JsqlDatabaseShape,
	IfExists extends boolean,
	SchemaName extends string,
> =
	ReadToken<AfterName> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? IfExists extends true
				? HasConcreteSchema<Db["schemas"], SchemaName> extends true
					? RemoveSchemaFromDb<Db, SchemaName & keyof Db["schemas"]> extends infer NewDb extends
							JsqlDatabaseShape
						? [R1, NewDb, null]
						: never
					: [R1, Db, null]
				: HasConcreteSchema<Db["schemas"], SchemaName> extends true
					? RemoveSchemaFromDb<Db, SchemaName & keyof Db["schemas"]> extends infer NewDb extends
							JsqlDatabaseShape
						? [R1, NewDb, null]
						: never
					: [R1, Db, SqlParserError<"Schema does not exist; use IF EXISTS">]
			: [R1, Db, SqlParserError<"Expected `;` after DROP SCHEMA">]
		: never

type ParseDropSchemaName<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ReadToken<Tokens> extends [infer AfterName extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer SchemaName extends string>
			? ParseDropSchemaAfterIdent<AfterName, Db, IfExists, SchemaName>
			: [AfterName, Db, SqlParserError<"Expected schema name in DROP SCHEMA">]
		: never

type RemoveSchemaFromDb<Db extends JsqlDatabaseShape, Sch extends keyof Db["schemas"]> = {
	defaultSchema: Db["defaultSchema"]
	schemas: Omit<Db["schemas"], Sch>
}
