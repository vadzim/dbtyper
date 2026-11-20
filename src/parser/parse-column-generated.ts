import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ColumnFail, ColumnStateWith } from "./parse-column-constraint-clauses.ts"
import type { FullAddColumn } from "./parse-column-alter-end.ts"
import type { SkipParenGroup } from "./parse-column-constraints.ts"
import type { ColumnCtx, ColumnState, ParseColumnConstraints } from "./parse-column-constraints.ts"

/**
 * After `GENERATED`: `ALWAYS AS (expr) [STORED | VIRTUAL]` (CORE-15, CORE-18), or an identity column
 * `ALWAYS | BY DEFAULT AS IDENTITY [(options)]` (PGT-18); the expressions and options are not typed.
 */
export type ParseColumnGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<"always">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"as">
				? ColumnGeneratedOrIdentity<SkipToken<R1>, C, S, true>
				: ColumnFail<R1, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"by">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"default">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"as">
							? ColumnGeneratedOrIdentity<SkipToken<R2>, C, S, false>
							: ColumnFail<R2, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>
						: never
					: ColumnFail<R1, C, FormatError<Errors["EXPECTED_ALWAYS_AFTER_GENERATED"], []>>
				: never
			: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_ALWAYS_AFTER_GENERATED"], []>>

/** `[(sequence options)]` after IDENTITY: `[rest, null | error]`. */
type IdentityOptions<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"("> ? SkipParenGroup<Tokens> : [Tokens, null]

/** After `GENERATED … AS`: `IDENTITY [(options)]` (NOT NULL; ALWAYS is not insertable, BY DEFAULT is optional) or `(expr)`. */
type ColumnGeneratedOrIdentity<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	Always extends boolean,
> =
	PeekToken<Tokens> extends TokenIdent<"identity">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? IdentityOptions<R1> extends [infer R2 extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? [R2, C["db"], E]
					: ParseColumnConstraints<
							R2,
							C,
							ColumnStateWith<
								S,
								Always extends true ? { nn: true; gen: "identity" } : { nn: true; def: true }
							>
						>
				: never
			: never
		: Always extends true
			? ColumnGeneratedBody<Tokens, C, S>
			: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>

/** `(expr) [STORED | VIRTUAL]` after `AS`. */
export type ColumnGeneratedBody<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipParenGroup<Tokens> extends [infer R2 extends ParserMonad, infer E]
		? E extends DbtyperErrorShape
			? [R2, C["db"], E]
			: PeekToken<R2> extends TokenKey<"stored">
				? // SQLite: "cannot add a STORED column" (#202)
					[C["alter"], FullAddColumn<C>] extends [true, never]
					? ColumnFail<R2, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["STORED"]>>
					: ParseColumnConstraints<SkipToken<R2>, C, ColumnStateWith<S, { gen: true }>>
				: PeekToken<R2> extends TokenKey<"virtual">
					? ParseColumnConstraints<SkipToken<R2>, C, ColumnStateWith<S, { gen: true }>>
					: ParseColumnConstraints<R2, C, ColumnStateWith<S, { gen: true }>>
		: never
