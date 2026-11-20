import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { ParseNameParts } from "./parse-qualified-name.ts"

type TableRefRow<Ctx extends string> = {
	name: FormatError<Errors["EXPECTED_TABLE_NAME"], [`in ${Ctx}`]>
	afterDot: FormatError<Errors["EXPECTED_TABLE_NAME"], [`after \`.\` in ${Ctx}`]>
	ends: never
	plain: null
	qualified: null
	skip: false
	home: "none"
}

/** What a table reference found: the schema it lives in, its name and its shape. */
export type TableRefTarget<Sch extends string, Tab extends string, Tbl extends JsqlDataShape> = {
	schema: Sch
	table: Tab
	tbl: Tbl
}

/** The lookup after the name: not there, a view where `Verb` writes (`null`: views are fine), or the table. */
type LookUpTableRef<
	Rest extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Written extends string | null,
	Sch extends string,
	Tab extends string,
	Ctx extends string,
	Verb extends string | null,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl
		? [Tbl] extends [never]
			? [Rest, TableRefMissing<Written, Tab, Ctx>, ParserRefErrorThirdSentinel]
			: [Tbl] extends [JsqlDataShape<"view">]
				? Verb extends string
					? [Rest, FormatError<Errors["CANNOT_WRITE_VIEW"], [Tab, Verb]>, ParserRefErrorThirdSentinel]
					: [Rest, null, TableRefTarget<Sch, Tab, JsqlDataShape<"view">>]
				: Tbl extends JsqlDataShape
					? [Rest, null, TableRefTarget<Sch, Tab, Tbl>]
					: [Rest, TableRefMissing<Written, Tab, Ctx>, ParserRefErrorThirdSentinel]
		: never

/** A written schema is named in the message ("unknown schema or table"), else the table. */
type TableRefMissing<Written extends string | null, Tab extends string, Ctx extends string> = Written extends string
	? FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [Written, Ctx]>
	: FormatError<Errors["UNKNOWN_TABLE"], [Tab, Ctx]>

/**
 * `[schema.]table` of INSERT INTO, UPDATE, DELETE FROM and DELETE USING, looked up in `Db`:
 * `[rest, null, TableRefTarget]`, or `[rest, error, ParserRefErrorThirdSentinel]`. `Ctx` names the clause in the
 * messages, `Verb` the statement for "cannot write a view" (`null`: a view may be read there).
 */
export type ParseTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Ctx extends string,
	Verb extends string | null,
> =
	ParseNameParts<Tokens, Db, TableRefRow<Ctx>> extends [infer R extends ParserMonad, infer E, infer Sch, infer Tab]
		? E extends null
			? Tab extends string
				? Sch extends string
					? LookUpTableRef<R, Db, Sch, Sch, Tab, Ctx, Verb>
					: LookUpTableRef<R, Db, null, UnqualifiedSchema<Db, Tab>, Tab, Ctx, Verb>
				: never
			: [R, E, ParserRefErrorThirdSentinel]
		: never
