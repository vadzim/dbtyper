import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseNameParts } from "./parse-qualified-name.ts"

type TableNameRow = {
	name: FormatError<Errors["EXPECTED_TABLE_NAME"], ["in CREATE TABLE"]>
	afterDot: FormatError<Errors["EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME"], []>
	ends: TokenKey<"("> | TokenKey<"as">
	plain: FormatError<Errors["EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME"], []>
	qualified: FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME"], []>
	skip: true
	home: "default"
}

/**
 * `[rest, null, schema, table]` on success; `[rest, err, never, never]` on parse failure. Unqualified names use
 * {@link JsqlDatabaseShape["defaultSchema"]} as the schema key.
 */
export type ParseQualifiedTableName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseNameParts<
	Tokens,
	Db,
	TableNameRow
>
