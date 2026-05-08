import type { JsqlDatabaseShape, JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type {
	PeekToken,
	SkipToken,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenString,
	TokensList,
} from "../lexer/sql-tokens.ts"
import type { DbtyperError, FormatError } from "../sql-parser-error.ts"
import type { ParseQualifiedTableName } from "./parse-qualified-table-name.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { JsqlCreateTable, JsqlDbGetSchema, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

export type ParseCreateTable<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends TokensList
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends TokensList
					? PeekToken<A1> extends TokenKey<"exists">
						? SkipToken<A1> extends infer A2 extends TokensList
							? ParseCreateTableQualified<A2, Db, true>
							: never
					: SkipFailedExpression<
								A1,
								FormatError<"EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE", []>
						  > extends [infer Rest extends TokensList, infer Err]
						? [Rest, Db, Err]
						: never
				: never
			: SkipFailedStatement<A0, Db, FormatError<"EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE", []>>
			: never
		: ParseCreateTableQualified<Tokens, Db, false>

type ColumnTriple = readonly [string, SqlTypeShape, boolean, boolean]

type ParseCreateTableQualifiedWhenSchKnown<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Entry
		? Entry extends null
			? ParseCreateTableOpenParen<R, Db, Sch, Tab, IfNotExists>
			: IfNotExists extends true
				? [R, Db, null]
				: SkipFailedStatement<R, Db, FormatError<"TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS", []>>
		: never

type ParseCreateTableQualifiedWhenNameOk<
	R extends TokensList,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends string,
	Tab extends string,
> =
	JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
		? Sch extends keyof Db["schemas"]
			? ParseCreateTableQualifiedWhenSchKnown<R, Db, IfNotExists, Sch & keyof Db["schemas"] & string, Tab>
			: never
		: SkipFailedStatement<R, Db, FormatError<"UNKNOWN_SCHEMA_FOR_CREATE_TABLE", []>>

type ParseCreateTableQualified<Tokens extends TokensList, Db extends JsqlDatabaseShape, IfNotExists extends boolean> =
	ParseQualifiedTableName<Tokens, Db> extends [
		infer R extends TokensList,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
	? E extends null
		? ParseCreateTableQualifiedWhenNameOk<R, Db, IfNotExists, Sch, Tab>
		: [R, Db, E extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string> ? E : FormatError<"INVALID_CREATE_TABLE_NAME_PARSE", []>]
		: never

type ParseCreateTableOpenParen<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	IfNotExists extends boolean,
> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends TokensList
			? OpenTok extends TokenKey<"(">
				? IfNotExists extends true
					? JsqlDbGetData<Db, Schema, Table> extends null
						? ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
						: ParseCreateTableBodySkipOnly<AfterOpen, Db>
					: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
				: SkipFailedExpression<
						AfterOpen,
						FormatError<"EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE", []>
				  > extends [infer Rest extends TokensList, infer Err]
				? [Rest, Db, Err]
				: never
			: never
		: never

type ParseCreateTableBodySkipOnly<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens, TokenKey<";">> extends [infer AfterSemi extends TokensList, infer R]
		? R extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
			? [SkipToken<AfterSemi>, Db, R]
			: [SkipToken<AfterSemi>, Db, null]
		: never

/** After `)`, read `;` or end. */
type ParseCreateTableCloseParenAndSemi<Tokens extends TokensList, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok1
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? Tok1 extends TokenKey<")">
				? PeekToken<R1> extends infer Tok2
					? SkipToken<R1> extends infer R2 extends TokensList
						? Tok2 extends TokenKey<";"> | TokenEot
							? [R2, NewDb, null]
							: SkipFailedStatement<R2, NewDb, FormatError<"EXPECTED_SEMICOLON_AFTER_CREATE_TABLE", []>>
						: never
					: never
				: SkipFailedStatement<R1, NewDb, FormatError<"EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE", []>>
			: never
		: never

type ParseCreateTableBody<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? ColumnsFromStack<Stack> extends infer M extends {
				cols: Record<string, SqlTypeShape>
				facts: Record<string, unknown>
			}
			? JsqlDbReplaceData<Db, Schema, Table, JsqlCreateTable<M["cols"], M["facts"]>> extends infer NewDb
				? NewDb extends JsqlDatabaseShape
					? ParseCreateTableCloseParenAndSemi<Tokens, NewDb>
					: never
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"constraint">
			? SkipConstraintClause<Tokens> extends [infer AfterC extends TokensList, infer CE]
				? CE extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
					? [AfterC, Db, CE]
					: CE extends null
						? ParseCreateTableBody<AfterC, Db, Schema, Table, Stack>
						: never
				: never
			: ParseOneColumn<Tokens, Db, Schema, Table, Stack>

type ParseOneColumnAfterColName<
	AfterColName extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
> =
	ParseSqlType<AfterColName> extends [infer AfterType extends TokensList, infer TypeShape]
		? TypeShape extends SqlTypeShape
			? TypeShape extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
				? [AfterType, Db, TypeShape]
				: ContinueAfterColumnType<AfterType, Db, Schema, Table, Stack, ColName, TypeShape>
			: [AfterType, Db, FormatError<"EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE", []>]
		: never

type ParseOneColumn<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
> =
	PeekToken<Tokens> extends TokenIdent<infer ColName extends string>
		? ParseOneColumnAfterColName<SkipToken<Tokens>, Db, Schema, Table, Stack, ColName>
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_COLUMN_NAME_IN_CREATE_TABLE", []>>

type ContinueAfterColumnType<
	AfterType extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	TypeShape extends SqlTypeShape,
> = TypeShape["nullable"] extends false
	? ContinueAfterColumnDef<AfterType, Db, Schema, Table, Stack, ColName, TypeShape, true>
	: ContinueAfterColumnDef<AfterType, Db, Schema, Table, Stack, ColName, TypeShape, false>

type SqlTypeClass<T extends SqlTypeShape> = T["type"] extends "array"
	? "array"
	: T["type"] extends
				| "integer"
				| "int"
				| "int2"
				| "int4"
				| "int8"
				| "smallint"
				| "bigint"
				| "serial"
				| "bigserial"
				| "smallserial"
				| "real"
				| "float4"
				| "float8"
				| "double precision"
				| "numeric"
				| "decimal"
				| "number"
		? "numeric"
		: T["type"] extends "boolean" | "bool"
			? "boolean"
			: T["type"] extends "text" | "varchar" | "character varying" | "char"
				? "text"
				: T["type"] extends "uuid"
					? "uuid"
					: T["type"] extends "bytea"
						? "bytea"
						: T["type"] extends
									| "date"
									| "time"
									| "time with time zone"
									| "timetz"
									| "timestamp"
									| "timestamp with time zone"
									| "timestamptz"
									| "interval"
							? "datetime"
							: T["type"] extends "inet" | "cidr"
								? "network"
								: T["type"] extends "tsvector" | "tsquery"
									? "fulltext"
									: "unknown"

type ParseDefaultValue<Tokens extends TokensList, ColumnType extends SqlTypeShape> =
	PeekToken<Tokens> extends TokenNumber<infer _Raw>
		? SkipToken<Tokens> extends infer R extends TokensList
			? SqlTypeClass<ColumnType> extends "numeric"
				? [R, null]
				: SkipFailedExpression<
						R,
						FormatError<"DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_NUMERIC_COLUMN_FOR_NUMERIC_LITERAL", []>
					>
			: never
		: PeekToken<Tokens> extends TokenString<infer _Str>
			? SkipToken<Tokens> extends infer R extends TokensList
				? SqlTypeClass<ColumnType> extends "text" | "uuid" | "unknown"
					? [R, null]
					: SkipFailedExpression<
							R,
							FormatError<"DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_TEXT_UUID_COLUMN_FOR_STRING_LITERAL", []>
						>
				: never
			: PeekToken<Tokens> extends TokenKey<"true"> | TokenKey<"false">
				? SkipToken<Tokens> extends infer R extends TokensList
					? SqlTypeClass<ColumnType> extends "boolean"
						? [R, null]
						: [
								R,
								FormatError<"DEFAULT_VALUE_TYPE_MISMATCH_EXPECTED_BOOLEAN_COLUMN_FOR_BOOLEAN_LITERAL", []>,
							]
					: never
				: PeekToken<Tokens> extends TokenKey<"null">
					? SkipToken<Tokens> extends infer R extends TokensList
						? [R, null]
						: never
				: PeekToken<Tokens> extends TokenIdent<infer FnName>
					? ParseDefaultFunctionOrIdent<Tokens, FnName, ColumnType>
					: SkipFailedExpression<Tokens, FormatError<"EXPECTED_DEFAULT_VALUE", []>>

type ParseDefaultFunctionOrIdent<Tokens extends TokensList, FnName extends string, ColumnType extends SqlTypeShape> =
	SkipToken<Tokens> extends infer R1 extends TokensList
		? PeekToken<R1> extends TokenKey<"(">
			? SkipToken<R1> extends infer R2 extends TokensList
				? PeekToken<R2> extends TokenKey<")">
					? SkipToken<R2> extends infer R3 extends TokensList
						? Lowercase<FnName> extends "now"
							? SqlTypeClass<ColumnType> extends "datetime"
								? [R3, null]
								: SkipFailedExpression<
										R3,
										FormatError<"DEFAULT_VALUE_TYPE_MISMATCH_NOW_REQUIRES_TIMESTAMP_COLUMN", []>
									>
							: Lowercase<FnName> extends "uuid_generate_v4" | "gen_random_uuid"
								? SqlTypeClass<ColumnType> extends "uuid"
									? [R3, null]
									: [
											R3,
											FormatError<"DEFAULT_VALUE_TYPE_MISMATCH_UUID_FUNCTION_REQUIRES_UUID_COLUMN", []>,
										]
								: [R3, null]
						: never
					: SkipFailedExpression<R2, FormatError<"EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT", []>>
				: never
			: [R1, null]
		: never

type ContinueAfterColumnDef<
	AfterNull extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	TypeShape extends SqlTypeShape,
	NotNull extends boolean,
> =
	PeekToken<AfterNull> extends TokenKey<"default">
		? SkipToken<AfterNull> extends infer AfterDefault extends TokensList
			? ParseDefaultValue<AfterDefault, TypeShape> extends [
					infer AfterDefaultVal extends TokensList,
					infer DefaultErr,
				]
				? DefaultErr extends null
					? ContinueAfterDefault<AfterDefaultVal, Db, Schema, Table, Stack, ColName, TypeShape, NotNull, true>
					: DefaultErr extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
						? [AfterDefaultVal, Db, DefaultErr]
						: never
				: never
			: never
		: PeekToken<AfterNull> extends TokenKey<",">
			? SkipToken<AfterNull> extends infer AfterComma extends TokensList
				? ParseCreateTableBody<
						AfterComma,
						Db,
						Schema,
						Table,
						readonly [...Stack, readonly [ColName, TypeShape, NotNull, false]]
					>
				: never
			: PeekToken<AfterNull> extends TokenKey<")"> | TokenKey<"constraint">
				? ParseCreateTableBody<
						AfterNull,
						Db,
						Schema,
						Table,
						readonly [...Stack, readonly [ColName, TypeShape, NotNull, false]]
					>
				: SkipFailedExpression<
						AfterNull,
						FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION", []>
				  > extends [infer Rest extends TokensList, infer Err]
				? [Rest, Db, Err]
				: never

type ContinueAfterDefault<
	AfterDefaultVal extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnTriple[],
	ColName extends string,
	TypeShape extends SqlTypeShape,
	NotNull extends boolean,
	HasDefault extends boolean,
> =
	PeekToken<AfterDefaultVal> extends TokenKey<",">
		? SkipToken<AfterDefaultVal> extends infer AfterComma extends TokensList
			? ParseCreateTableBody<
					AfterComma,
					Db,
					Schema,
					Table,
					readonly [...Stack, readonly [ColName, TypeShape, NotNull, HasDefault]]
				>
			: never
		: PeekToken<AfterDefaultVal> extends TokenKey<")"> | TokenKey<"constraint">
			? ParseCreateTableBody<
					AfterDefaultVal,
					Db,
					Schema,
					Table,
					readonly [...Stack, readonly [ColName, TypeShape, NotNull, HasDefault]]
				>
			: SkipFailedStatement<AfterDefaultVal, Db, FormatError<"EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE", []>>

type ColPair = { cols: Record<string, SqlTypeShape>; facts: Record<string, unknown> }

type OneCol<C extends ColumnTriple> = C extends readonly [
	infer N extends string,
	infer Sql extends SqlTypeShape,
	infer NotNull extends boolean,
	infer HasDefault extends boolean,
]
	? {
			cols: Record<N, Sql>
			facts: NotNull extends true
				? HasDefault extends true
					? Record<N, { nullability: "not_null"; default: true }>
					: Record<N, { nullability: "not_null" }>
				: HasDefault extends true
					? Record<N, { default: true }>
					: {}
		}
	: never

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

type MergeColPair<A extends ColPair, B extends ColPair> = {
	cols: MergeRecords<A["cols"], B["cols"]>
	facts: MergeRecords<A["facts"], B["facts"]>
}

/** Batched merge (chunks of 4) to keep conditional-type depth bounded on wide tables. */
type ColumnsFromStack<S extends readonly ColumnTriple[]> = S extends readonly []
	? { cols: {}; facts: {} }
	: S extends readonly [infer C0 extends ColumnTriple]
		? OneCol<C0>
		: S extends readonly [infer C0 extends ColumnTriple, infer C1 extends ColumnTriple]
			? MergeColPair<OneCol<C0>, OneCol<C1>>
			: S extends readonly [
						infer C0 extends ColumnTriple,
						infer C1 extends ColumnTriple,
						infer C2 extends ColumnTriple,
				  ]
				? MergeColPair<OneCol<C0>, MergeColPair<OneCol<C1>, OneCol<C2>>>
				: S extends readonly [
							infer C0 extends ColumnTriple,
							infer C1 extends ColumnTriple,
							infer C2 extends ColumnTriple,
							infer C3 extends ColumnTriple,
							...infer Rest extends readonly ColumnTriple[],
					  ]
					? Rest extends readonly []
						? MergeColPair<MergeColPair<OneCol<C0>, OneCol<C1>>, MergeColPair<OneCol<C2>, OneCol<C3>>>
						: MergeColPair<
								MergeColPair<
									MergeColPair<OneCol<C0>, OneCol<C1>>,
									MergeColPair<OneCol<C2>, OneCol<C3>>
								>,
								ColumnsFromStack<Rest>
							>
					: { cols: {}; facts: {} }

type SkipConstraintAfterKeyTok<AfterKeyTok extends TokensList> =
	PeekToken<AfterKeyTok> extends infer T4
		? SkipToken<AfterKeyTok> extends infer AfterLp extends TokensList
			? T4 extends TokenKey<"(">
				? SkipBracketedUntil<AfterLp, TokenKey<")">> extends [infer R extends TokensList, infer Res]
					? Res extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
						? SkipFailedExpression<R, Res>
						: [SkipToken<R>, null]
					: never
				: [AfterLp, null]
			: never
		: never

type SkipConstraintAfterPrim<AfterPrim extends TokensList> =
	PeekToken<AfterPrim> extends infer T3
		? SkipToken<AfterPrim> extends infer AfterKeyTok extends TokensList
			? T3 extends TokenKey<"key">
				? SkipConstraintAfterKeyTok<AfterKeyTok>
				: [AfterKeyTok, null]
			: never
		: never

type SkipConstraintAfterName<AfterName extends TokensList> =
	PeekToken<AfterName> extends infer T2
		? SkipToken<AfterName> extends infer AfterPrim extends TokensList
			? T2 extends TokenKey<"primary">
				? SkipConstraintAfterPrim<AfterPrim>
				: [AfterPrim, null]
			: never
		: never

type SkipConstraintAfterKw<AfterKw extends TokensList> =
	PeekToken<AfterKw> extends infer T1
		? SkipToken<AfterKw> extends infer AfterName extends TokensList
			? T1 extends TokenIdent<string>
				? SkipConstraintAfterName<AfterName>
				: [AfterName, null]
			: never
		: never

type SkipConstraintClause<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer T0
		? SkipToken<Tokens> extends infer AfterKw extends TokensList
			? T0 extends TokenKey<"constraint">
				? SkipConstraintAfterKw<AfterKw>
				: [AfterKw, null]
			: never
		: never
