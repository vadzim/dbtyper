import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetData, JsqlDbReplaceData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { ReplaceProp } from "../core/type-utils.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { ParseSkipStatement, SkipFailedStatement } from "./skip-statement.ts"

/**
 * SQLT-74 (#206 item 1): where the dialect has `INDEXED BY` (`trackedIndexes`, SQLite), `CREATE [UNIQUE] INDEX
 * [IF NOT EXISTS] [schema.]name ON table …` records `name` on its table (`indexes` of the table data, a union of names),
 * so `INDEXED BY name` can check it; `DROP INDEX [IF EXISTS] [schema.]name` removes it, DROP TABLE drops it with the
 * table; ALTER TABLE … RENAME keeps them (they are part of the table data). The rest of the statement (columns,
 * expressions, WHERE) is stepped over unchecked. A table the name `ON` does not find is 2200; a form this reader does
 * not follow (no name, no `ON`) is skipped without recording anything.
 */
export type IndexNamesOf<Tbl> = Tbl extends { indexes: infer N extends string } ? N : never

/** `CREATE …` at `UNIQUE` or `INDEX`. */
export type ParseCreateIndex<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	DialectFact<Db, "trackedIndexes"> extends true
		? PeekToken<Tokens> extends TokenKey<"unique">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"index">
					? IndexAfterKeyword<SkipToken<R1>, Db, "create">
					: ParseSkipStatement<R1, Db>
				: never
			: IndexAfterKeyword<SkipToken<Tokens>, Db, "create">
		: ParseSkipStatement<Tokens, Db>

/** `DROP INDEX` at the token after `INDEX`. */
export type ParseDropIndex<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	DialectFact<Db, "trackedIndexes"> extends true
		? IndexAfterKeyword<Tokens, Db, "drop">
		: ParseSkipStatement<Tokens, Db>

/** After `INDEX`: `IF NOT EXISTS` (CREATE) or `IF EXISTS` (DROP), then the name. */
type IndexAfterKeyword<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Verb extends "create" | "drop"> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Verb extends "drop"
				? PeekToken<R1> extends TokenKey<"exists">
					? IndexName<SkipToken<R1>, Db, Verb>
					: ParseSkipStatement<R1, Db>
				: PeekToken<R1> extends TokenKey<"not">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"exists">
							? IndexName<SkipToken<R2>, Db, Verb>
							: ParseSkipStatement<R2, Db>
						: never
					: ParseSkipStatement<R1, Db>
			: never
		: IndexName<Tokens, Db, Verb>

/** `[schema.]name` of the index (a `main.` or `temp.` is not checked, SQLT-74). */
type IndexName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, Verb extends "create" | "drop"> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? IndexAfterName<SkipToken<R2>, Db, Verb, B>
						: ParseSkipStatement<R2, Db>
					: never
				: IndexAfterName<R1, Db, Verb, A>
			: never
		: ParseSkipStatement<Tokens, Db>

/**
 * After the index name: DROP removes it; CREATE reads `ON table` and keeps the index on the table that name finds
 * (an unknown table is 2200).
 */
type IndexAfterName<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Verb extends "create" | "drop",
	Name extends string,
> = Verb extends "drop"
	? ParseSkipStatement<Tokens, DropIndexName<Db, Name>>
	: PeekToken<Tokens> extends TokenKey<"on">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer Tab extends string>
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? JsqlDbGetData<Db, UnqualifiedSchema<Db, Tab>, Tab> extends infer Tbl
						? [Tbl] extends [JsqlDataShape<"table">]
							? ParseSkipStatement<R2, AddIndexName<Db, UnqualifiedSchema<Db, Tab>, Tab, Tbl, Name>>
							: [Tbl] extends [JsqlDataShape]
								? ParseSkipStatement<R2, Db> // a view: nothing to keep
								: SkipFailedStatement<
										R2,
										Db,
										FormatError<Errors["UNKNOWN_TABLE"], [Tab, "CREATE INDEX"]>
									>
						: never
					: never
				: ParseSkipStatement<R1, Db>
			: never
		: ParseSkipStatement<Tokens, Db>

/** `Db` with `Name` among the indexes of the table `Sch.Tab`. */
type AddIndexName<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Name extends string,
> =
	ReplaceProp<Tbl, "indexes", IndexNamesOf<Tbl> | Name> extends infer NewTbl extends JsqlDataShape
		? JsqlDbReplaceData<Db, Sch, Tab, NewTbl>
		: Db

/** `Db` without the index `Name`, whichever schema's table has it (unchanged when none has it). */
type DropIndexName<Db extends JsqlDatabaseShape, Name extends string> = {
	[S in keyof Db["schemas"]]: Db["schemas"][S] extends { sets: infer Sets }
		? { [T in keyof Sets]: Name extends IndexNamesOf<Sets[T]> ? [S, T] : never }[keyof Sets]
		: never
}[keyof Db["schemas"]] extends infer Found
	? [Found] extends [never]
		? Db
		: Found extends [infer Sch extends string, infer Tab extends string]
			? JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
				? ReplaceProp<Tbl, "indexes", Exclude<IndexNamesOf<Tbl>, Name>> extends infer NewTbl extends
						JsqlDataShape
					? JsqlDbReplaceData<Db, Sch, Tab, NewTbl>
					: Db
				: Db
			: Db
	: Db
