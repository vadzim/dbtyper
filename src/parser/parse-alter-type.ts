import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenString } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedExpression, SkipFailedStatement, ParseSkipStatement } from "./skip-statement.ts"
import type { JsqlDbGetEnum, JsqlDbReplaceEnum } from "../core/jsql-utils.ts"

export type ParseAlterType<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"exists">
				? ParseAlterTypeQualified<SkipToken<A0>, Db, true>
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_IN_ALTER_TYPE"], []>>
			: never
		: ParseAlterTypeQualified<Tokens, Db, false>

/** After `schema.` in qualified `ALTER TYPE schema.type`. */
type ParseAlterQualifiedSecondIdent<AfterDot extends ParserMonad, A extends string> =
	AsIdent<PeekToken<AfterDot>> extends TokenIdent<infer B extends string>
		? [SkipToken<AfterDot>, null, A, B]
		: SkipFailedQualifiedName<AfterDot, FormatError<Errors["EXPECTED_TYPE_NAME"], ["after `.` in ALTER TYPE"]>>

/** After first identifier (type or schema). */
type ParseAlterAfterFirstIdent<AfterFirst extends ParserMonad, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"add" | "rename">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: PeekToken<AfterFirst> extends TokenKey<".">
			? ParseAlterQualifiedSecondIdent<SkipToken<AfterFirst>, A>
			: SkipFailedQualifiedName<AfterFirst, FormatError<Errors["EXPECTED_DOT_OR_ADD_IN_ALTER_TYPE"], []>>

/** `[rest, null, schema, type]` on success; `[rest, error, never, never]` on parse failure. */
type ParseQualifiedTypeNameForAlter<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? ParseAlterAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: SkipFailedQualifiedName<Tokens, FormatError<Errors["EXPECTED_TYPE_NAME"], ["in ALTER TYPE"]>>

type ParseAlterTypeQualified<Tokens extends ParserMonad, Db extends JsqlDatabaseShape, IfExists extends boolean> =
	ParseQualifiedTypeNameForAlter<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Typ extends string,
	]
		? E extends null
			? IfExists extends true
				? JsqlDbGetEnum<Db, Sch, Typ> extends infer Values extends readonly string[]
					? ParseAlterTypeAction<R, Db, Sch, Typ, Values>
					: ParseSkipStatement<R, Db> // IF EXISTS and absent: the rest of the statement is stepped over
				: JsqlDbGetEnum<Db, Sch, Typ> extends infer Values extends readonly string[]
					? ParseAlterTypeAction<R, Db, Sch, Typ, Values>
					: SkipFailedExpression<
								R,
								FormatError<Errors["TYPE_DOES_NOT_EXIST_OR_IS_NOT_AN_ENUM_USE_IF_EXISTS"], []>
						  > extends [infer Rest extends ParserMonad, infer Err]
						? [Rest, Db, Err]
						: never
			: [R, Db, E extends DbtyperErrorShape ? E : FormatError<Errors["INVALID_ALTER_TYPE_PARSE"], []>]
		: never

/** `ADD VALUE …` or `RENAME VALUE 'a' TO 'b'` (PGT-13, #171). */
type ParseAlterTypeAction<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
> =
	PeekToken<Tokens> extends infer AddTok
		? SkipToken<Tokens> extends infer AfterAdd extends ParserMonad
			? AddTok extends TokenKey<"add"> | TokenKey<"rename">
				? PeekToken<AfterAdd> extends infer ValueTok
					? SkipToken<AfterAdd> extends infer AfterValue extends ParserMonad
						? ValueTok extends TokenIdent<"value">
							? AddTok extends TokenKey<"add">
								? ParseAlterTypeAddValue<AfterValue, Db, Sch, Typ, Values>
								: ParseAlterTypeRenameValue<AfterValue, Db, Sch, Typ, Values>
							: SkipFailedExpression<
										AfterValue,
										FormatError<Errors["EXPECTED_VALUE_AFTER_ADD_IN_ALTER_TYPE"], []>
								  > extends [infer Rest extends ParserMonad, infer Err]
								? [Rest, Db, Err]
								: never
						: never
					: never
				: SkipFailedStatement<AfterAdd, Db, FormatError<Errors["EXPECTED_ADD_IN_ALTER_TYPE"], []>>
			: never
		: never

/** At an enum label: `[rest, label]` or `[rest, error]`. */
type ReadEnumLabel<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenString<infer V extends string>
		? [SkipToken<Tokens>, V]
		: [Tokens, FormatError<Errors["EXPECTED_STRING_LITERAL_FOR_ENUM_VALUE_IN_ALTER_TYPE"], []>]

/** `ADD VALUE [IF NOT EXISTS] 'x' [BEFORE | AFTER 'y']`: an existing label is an error, or a no-op with IF NOT EXISTS. */
type ParseAlterTypeAddValue<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"not">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? PeekToken<R2> extends TokenKey<"exists">
						? ParseAlterTypeAddLabel<SkipToken<R2>, Db, Sch, Typ, Values, true>
						: SkipFailedStatement<
								R2,
								Db,
								FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TYPE"], []>
							>
					: never
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_NOT_AFTER_IF_IN_CREATE_TYPE"], []>>
			: never
		: ParseAlterTypeAddLabel<Tokens, Db, Sch, Typ, Values, false>

type ParseAlterTypeAddLabel<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
	IfNotExists extends boolean,
> =
	ReadEnumLabel<Tokens> extends [infer AfterVal extends ParserMonad, infer NewValue]
		? NewValue extends DbtyperErrorShape
			? SkipFailedStatement<AfterVal, Db, NewValue>
			: NewValue extends string
				? ParseAlterTypePosition<AfterVal, Values, NewValue> extends [
						infer R extends ParserMonad,
						infer NewValues,
					]
					? NewValues extends DbtyperErrorShape
						? SkipFailedStatement<R, Db, NewValues>
						: NewValue extends Values[number]
							? IfNotExists extends true
								? ParseAlterTypeCloseSemi<R, Db>
								: SkipFailedStatement<R, Db, FormatError<Errors["ENUM_VALUE_ALREADY_EXISTS"], []>>
							: NewValues extends readonly string[]
								? ParseAlterTypeCloseSemi<R, JsqlDbReplaceEnum<Db, Sch, Typ, NewValues>>
								: never
					: never
				: never
		: never

/** `[BEFORE | AFTER 'y']`: `[rest, labels with the new one in place]` or `[rest, error]` when `y` is no label. */
type ParseAlterTypePosition<Tokens extends ParserMonad, Values extends readonly string[], New extends string> =
	PeekToken<Tokens> extends TokenIdent<"before" | "after">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? ReadEnumLabel<R0> extends [infer R extends ParserMonad, infer Anchor]
				? Anchor extends DbtyperErrorShape
					? [R, Anchor]
					: Anchor extends Values[number] & string
						? [
								R,
								InsertLabel<
									Values,
									Anchor,
									New,
									PeekToken<Tokens> extends TokenIdent<"before"> ? true : false
								>,
							]
						: [R, FormatError<Errors["ENUM_VALUE_DOES_NOT_EXIST"], [`'${Anchor & string}'`]>]
				: never
			: never
		: [Tokens, readonly [...Values, New]]

type InsertLabel<
	Values extends readonly string[],
	Anchor extends string,
	New extends string,
	Before extends boolean,
	Acc extends readonly string[] = readonly [],
> = Values extends readonly [infer H extends string, ...infer T extends readonly string[]]
	? H extends Anchor
		? Before extends true
			? readonly [...Acc, New, H, ...T]
			: readonly [...Acc, H, New, ...T]
		: InsertLabel<T, Anchor, New, Before, readonly [...Acc, H]>
	: readonly [...Acc, New]

/** `RENAME VALUE 'a' TO 'b'`: `a` must be a label and `b` not yet one (PGT-13). */
type ParseAlterTypeRenameValue<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Typ extends string,
	Values extends readonly string[],
> =
	ReadEnumLabel<Tokens> extends [infer R1 extends ParserMonad, infer Old]
		? Old extends DbtyperErrorShape
			? SkipFailedStatement<R1, Db, Old>
			: PeekToken<R1> extends TokenKey<"to">
				? SkipToken<R1> extends infer R1b extends ParserMonad
					? ReadEnumLabel<R1b> extends [infer R2 extends ParserMonad, infer New]
						? New extends DbtyperErrorShape
							? SkipFailedStatement<R2, Db, New>
							: Old extends Values[number]
								? New extends Values[number]
									? SkipFailedStatement<R2, Db, FormatError<Errors["ENUM_VALUE_ALREADY_EXISTS"], []>>
									: ParseAlterTypeCloseSemi<
											R2,
											JsqlDbReplaceEnum<
												Db,
												Sch,
												Typ,
												{
													[I in keyof Values]: Values[I] extends Old
														? New & string
														: Values[I]
												}
											>
										>
								: SkipFailedStatement<
										R2,
										Db,
										FormatError<Errors["ENUM_VALUE_DOES_NOT_EXIST"], [`'${Old & string}'`]>
									>
						: never
					: never
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_TO_IN_RENAME_VALUE"], []>>
		: never

type ParseAlterTypeCloseSemi<Tokens extends ParserMonad, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, NewDb, null]
		: SkipFailedStatement<Tokens, NewDb, FormatError<Errors["EXPECTED_SEMICOLON"], ["ALTER TYPE"]>>
