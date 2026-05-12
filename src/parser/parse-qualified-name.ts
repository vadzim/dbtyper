import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { FormatError } from "../dbtyper-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"

/** After `schema.` in qualified name. */
type ParseQualifiedSecondIdent<AfterDot extends TokensList, A extends string> =
	PeekToken<AfterDot> extends infer T2
		? SkipToken<AfterDot> extends infer R2 extends TokensList
			? T2 extends TokenIdent<infer B extends string>
				? [R2, null, A, B]
				: SkipFailedQualifiedName<R2, FormatError<"EXPECTED_NAME_AFTER_DOT_IN_QUALIFIED_NAME", []>>
			: never
		: never

/** After first identifier (name or schema). */
type ParseAfterFirstIdent<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"as"> | TokenKey<"add"> | TokenKey<";"> | TokenEot
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends infer T1
			? SkipToken<AfterFirst> extends infer R1 extends TokensList
				? T1 extends TokenKey<".">
					? ParseQualifiedSecondIdent<R1, A>
					: SkipFailedQualifiedName<R1, FormatError<"EXPECTED_DOT_OR_KEYWORD_AFTER_NAME", []>>
				: never
			: never

/** `[rest, null, schema, name]` on success; `[rest, error, never, never]` on parse failure. */
export type ParseQualifiedName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer NameTok
		? SkipToken<Tokens> extends infer AfterFirst extends TokensList
			? NameTok extends TokenIdent<infer A extends string>
				? ParseAfterFirstIdent<AfterFirst, Db, A>
				: SkipFailedQualifiedName<AfterFirst, FormatError<"EXPECTED_NAME", []>>
			: never
		: never
