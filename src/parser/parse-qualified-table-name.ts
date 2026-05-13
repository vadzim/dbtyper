import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError } from "../dbtyper-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"

/** After `schema.` — parse table name, then peek `(`. */
type ParseQualifiedSecondIdent<AfterDot extends ParserMonad, _Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterDot> extends infer Tok2
		? SkipToken<AfterDot> extends infer R2 extends ParserMonad
			? Tok2 extends TokenIdent<infer B extends string>
				? PeekToken<R2> extends TokenKey<"(">
					? [R2, null, A, B]
					: SkipFailedQualifiedName<R2, FormatError<"EXPECTED_OPEN_PAREN_AFTER_QUALIFIED_TABLE_NAME", []>>
				: SkipFailedQualifiedName<R2, FormatError<"EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME", []>>
			: never
		: never

/** After first ident `A` (unqualified or `A.`…). Unqualified names use {@link JsqlDatabaseShape["defaultSchema"]} as the schema key. */
type ParseQualifiedAfterFirstIdent<AfterFirst extends ParserMonad, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"(">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer Tdot
			? SkipToken<AfterFirst> extends infer AfterDot extends ParserMonad
				? Tdot extends TokenKey<".">
					? ParseQualifiedSecondIdent<AfterDot, Db, A>
					: SkipFailedQualifiedName<AfterDot, FormatError<"EXPECTED_DOT_OR_OPEN_PAREN_AFTER_TABLE_NAME", []>>
				: never
			: never

/** `[rest, null, schema, table]` on success; `[rest, err, never, never]` on parse failure. */
export type ParseQualifiedTableName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends ParserMonad
			? NameTok extends TokenIdent<infer A extends string>
				? ParseQualifiedAfterFirstIdent<AfterFirst, Db, A>
				: SkipFailedQualifiedName<AfterFirst, FormatError<"EXPECTED_TABLE_NAME", ["in CREATE TABLE"]>>
			: never
		: never
