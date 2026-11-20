import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipBracketedUntil, SkipFailedExpression } from "./skip-statement.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ColumnDef, HasPrimaryKey, MultiplePrimaryKeys, PkKind } from "./parse-create-table.ts"
import type { ParseCreateTableAfterComma, ParseCreateTableBody } from "./parse-create-table-columns.ts"
import type { ParseReferences } from "./parse-column-references.ts"
import type { AlterColumnDone } from "./parse-column-alter-end.ts"
import type {
	ColumnAfterGroup,
	ColumnAutoincrement,
	ColumnCollate,
	ColumnConstraintName,
	ColumnEntry,
	ColumnFail,
	ColumnNotNull,
	ColumnOnConflict,
	ColumnPrimaryKey,
	ColumnShortGenerated,
	ColumnStateWith,
	ColumnUnique,
} from "./parse-column-constraint-clauses.ts"
import type { ParseColumnDefault } from "./parse-column-default.ts"
import type { ParseColumnGenerated } from "./parse-column-generated.ts"

export type SerialName = "serial" | "bigserial" | "smallserial" | "serial2" | "serial4" | "serial8"

/** The column being parsed (see {@link ParseColumnConstraints}). */
export type ColumnCtx = {
	db: JsqlDatabaseShape
	schema: string
	table: string
	stack: readonly ColumnDef[]
	name: string
	type: SqlTypeShape
	/** The declared type name, lower-case (SQLite only: the affinity and STRICT rules read it, SQLT-6…SQLT-11). */
	declared: string
	/** The column is the one of `ALTER TABLE … ADD COLUMN` (SQLite, SQLT-21): the definition ends at `;`, not `)`. */
	alter: boolean
}

/** What the constraints seen so far say about the column; `afterDefault` is true right after a DEFAULT (error text). */
export type ColumnState = {
	nn: boolean
	def: boolean
	/** A generated column (CORE-18), or `"identity"`: `GENERATED ALWAYS AS IDENTITY`, writable with OVERRIDING (PGT-25). */
	gen: boolean | "identity"
	afterDefault: boolean
	pk: PkKind
}

/**
 * Column constraints in any order after the type (CORE-15): NOT NULL, NULL, DEFAULT, PRIMARY KEY, UNIQUE, CHECK,
 * REFERENCES, COLLATE, GENERATED ALWAYS AS, each optionally named with CONSTRAINT. Ends at `,` or `)`.
 * Each constraint has its own parser entered AT its keyword, so a monad is never consumed twice on one path.
 */
export type ParseColumnConstraints<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<",">
		? C["alter"] extends true
			? AlterColumnDone<Tokens, C, S>
			: ParseCreateTableAfterComma<
					SkipToken<Tokens>,
					C["db"],
					C["schema"],
					C["table"],
					readonly [...C["stack"], ColumnEntry<C, S>]
				>
		: PeekToken<Tokens> extends TokenKey<")">
			? C["alter"] extends true
				? AlterColumnDone<Tokens, C, S>
				: ParseCreateTableBody<
						Tokens,
						C["db"],
						C["schema"],
						C["table"],
						readonly [...C["stack"], ColumnEntry<C, S>]
					>
			: PeekToken<Tokens> extends TokenKey<"constraint">
				? ColumnConstraintName<Tokens, C, S>
				: PeekToken<Tokens> extends TokenKey<"not">
					? ColumnNotNull<Tokens, C, S>
					: PeekToken<Tokens> extends TokenKey<"null">
						? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, { nn: false }>>
						: PeekToken<Tokens> extends TokenKey<"default">
							? ParseColumnDefault<SkipToken<Tokens>, C, S>
							: PeekToken<Tokens> extends TokenKey<"primary">
								? HasPrimaryKey<C["stack"], S["pk"]> extends true
									? MultiplePrimaryKeys<Tokens, C["db"], C["table"]>
									: ColumnPrimaryKey<Tokens, C, S>
								: PeekToken<Tokens> extends TokenKey<"unique">
									? ColumnUnique<Tokens, C, S>
									: PeekToken<Tokens> extends TokenKey<"check">
										? SkipParenGroup<SkipToken<Tokens>> extends [
												infer R extends ParserMonad,
												infer E,
											]
											? ColumnAfterGroup<R, E, C, S>
											: never
										: PeekToken<Tokens> extends TokenKey<"references">
											? ParseReferences<
													SkipToken<Tokens>,
													C["db"],
													C["schema"],
													C["table"]
												> extends [infer R extends ParserMonad, infer E]
												? ColumnAfterGroup<R, E, C, S>
												: never
											: PeekToken<Tokens> extends TokenIdent<"collate">
												? ColumnCollate<Tokens, C, S>
												: PeekToken<Tokens> extends TokenKey<"generated">
													? ParseColumnGenerated<SkipToken<Tokens>, C, S>
													: PeekToken<Tokens> extends TokenIdent<"autoincrement">
														? ColumnAutoincrement<Tokens, C, S>
														: PeekToken<Tokens> extends TokenKey<"as">
															? ColumnShortGenerated<Tokens, C, S>
															: ColumnGenericFail<Tokens, C, S>

/** The error for a token that no column constraint starts with. */
export type ColumnGenericFail<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenIdent<"deferrable" | "initially">
		? ColumnDeferrable<Tokens, C, S>
		: ColumnGenericFailNoDefer<Tokens, C, S>

/** PGT-18: `DEFERRABLE`, `INITIALLY DEFERRED | IMMEDIATE` change nothing the types see. */
type ColumnDeferrable<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenIdent<"initially">
		? ParseColumnConstraints<SkipToken<SkipToken<Tokens>>, C, ColumnStateWith<S, {}>>
		: ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>

type ColumnGenericFailNoDefer<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
> = C["alter"] extends true
	? PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? AlterColumnDone<Tokens, C, S>
		: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_SEMICOLON"], ["ALTER TABLE"]>>
	: PeekToken<Tokens> extends OnConflictToken<C["db"]>
		? ColumnOnConflict<Tokens, C, S>
		: ColumnFail<
				Tokens,
				C,
				S["afterDefault"] extends true
					? FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE"], []>
					: FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
			>

/** SQLite (SQLT-18): the type parser takes `NOT NULL`, so `ON CONFLICT` can follow the type; nothing else has `ON` here. */
type OnConflictToken<Db extends JsqlDatabaseShape> =
	DialectFact<Db, "constraintOnConflict"> extends true ? TokenKey<"on"> : never

/** `[rest, null | error]` after a bracketed group `( … )` (the `(` is the next token). */
export type SkipParenGroup<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<")">> extends [infer R extends ParserMonad, infer Res]
			? Res extends DbtyperErrorShape
				? SkipFailedExpression<R, Res>
				: [SkipToken<R>, null]
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT"], []>>
