import type { AddColumn } from "./sql-column.js"
import type {
	ConsumeStatementEnd,
	ReadBufferEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadOptionalIfNotExists,
	ReadExpectedIdentifier,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type {
	ForeignRefMeta,
	ParseColumnListToTuple,
	ParseForeignKeyMetaAndRest,
	ReadConstraintEntryMatch,
} from "./sql-constraints-fk.js"
import type { SkipStatement, SkippedStatement } from "./skip-statement.js"
import type { PeekToken, SkipToken, TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type AlterTableStatement = {
	readonly kind: "alter_table"
	readonly ifExists: boolean
	readonly target: SqlQualifiedIdentifier
	readonly action: SqlAlterTableAction
}

/** `B` is immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseAlterTable<B extends TokensList> = FinalizeAlterTableTuple<ParseAlterTableTupleAfterTable<B>>

type FinalizeAlterTableTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends TokensList]
			? [Result, Tail]
			: [SqlParserError<"Expected an ALTER TABLE statement with a table target">, Rest]
		: [SqlParserError<"Expected an ALTER TABLE statement with a table target">, EmptyTokenList]

type SqlAlterTableActionAddColumn = {
	readonly kind: "add_column"
	readonly ifNotExists: boolean
	readonly name: string
	readonly definition: unknown
}

type SqlAlterTableActionDropColumn = {
	readonly kind: "drop_column"
	readonly ifExists: boolean
	readonly name: string
}

type SqlAlterTableActionRenameTo = {
	readonly kind: "rename_to"
	readonly name: string
}

type SqlAlterTableActionRenameColumn = {
	readonly kind: "rename_column"
	readonly from: string
	readonly to: string
}

type SqlAlterTableActionAddConstraintFk = {
	readonly kind: "add_constraint_fk"
	readonly refs: ForeignRefMeta
}

type SqlAlterTableActionAddConstraintPk = {
	readonly kind: "add_constraint_primary"
	readonly columns: readonly string[]
}

type SqlAlterTableActionAddConstraintUnique = {
	readonly kind: "add_constraint_unique"
	readonly columns: readonly string[]
}

type SqlAlterTableActionDropConstraint = {
	readonly kind: "drop_constraint"
	readonly ifExists: boolean
	readonly name: string
}

type SqlAlterTableAction =
	| SqlAlterTableActionAddColumn
	| SqlAlterTableActionDropColumn
	| SqlAlterTableActionRenameTo
	| SqlAlterTableActionRenameColumn
	| SqlAlterTableActionAddConstraintFk
	| SqlAlterTableActionAddConstraintPk
	| SqlAlterTableActionAddConstraintUnique
	| SqlAlterTableActionDropConstraint

type ParseIdentifierToken<B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [
		infer Name extends string,
		infer Rest extends TokensList,
	]
		? [Name, Rest]
		: never

type ParseAlterAction<B extends TokensList> =
	ReadBufferEnd<B> extends [infer AtEnd, infer Rem extends TokensList]
		? AtEnd extends true
			? SqlParserError<"Expected an ALTER TABLE action">
			: ReadExpectedToken<Rem, "add", "Expected an ALTER TABLE action"> extends [
						infer AddResult,
						infer AddRest extends TokensList,
				  ]
				? AddResult extends SqlParserError<string>
					? ReadExpectedToken<Rem, "drop", "Expected an ALTER TABLE action"> extends [
							infer DropResult,
							infer DropRest extends TokensList,
						]
						? DropResult extends SqlParserError<string>
							? ReadExpectedToken<Rem, "rename", "Expected an ALTER TABLE action"> extends [
									infer RenameResult,
									infer RenameRest extends TokensList,
								]
								? RenameResult extends SqlParserError<string>
									? SqlParserError<"Unsupported ALTER TABLE action">
									: ParseAlterActionRename<RenameRest>
								: SqlParserError<"Unsupported ALTER TABLE action">
							: ParseAlterActionDrop<DropRest>
						: SqlParserError<"Unsupported ALTER TABLE action">
					: ParseAlterActionAdd<AddRest>
				: SqlParserError<"Unsupported ALTER TABLE action">
		: never

type ParseAlterActionAdd<B extends TokensList> =
	PeekToken<B> extends "column"
		? ParseAlterActionAddColumn<SkipToken<B>>
		: PeekToken<B> extends "constraint"
			? ParseAlterAddConstraint<SkipToken<B>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<B extends TokensList> =
	PeekToken<B> extends "column"
		? ParseAlterActionDropColumn<SkipToken<B>>
		: PeekToken<B> extends "constraint"
			? ParseAlterDropConstraint<SkipToken<B>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<B extends TokensList> =
	ReadExpectedToken<B, "to", "Unsupported ALTER TABLE action"> extends [
		infer ToResult,
		infer ToTail extends TokensList,
	]
		? ToResult extends SqlParserError<string>
			? ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
					infer ColumnResult,
					infer ColumnTail extends TokensList,
				]
				? ColumnResult extends SqlParserError<string>
					? SqlParserError<"Unsupported ALTER TABLE action">
					: ParseAlterActionRenameColumn<ColumnTail>
				: SqlParserError<"Unsupported ALTER TABLE action">
			: ParseAlterActionRenameTo<ToTail>
		: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<B extends TokensList> =
	ReadOptionalIfNotExists<B> extends [true, infer Rest extends TokensList]
		? ParseAlterActionAddColumnWithFlag<true, Rest>
		: ReadOptionalIfNotExists<B> extends [false, infer Rest extends TokensList]
			? ParseAlterActionAddColumnWithFlag<false, Rest>
			: ReadOptionalIfNotExists<B> extends [infer Error extends SqlParserError<string>, TokensList]
				? Error
				: SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends TokensList> =
	ReadBufferEnd<Rest> extends [infer AtEnd, infer Rem extends TokensList]
		? AtEnd extends true
			? SqlParserError<"Expected a column definition in ALTER TABLE ADD COLUMN">
			: AddColumn<Rem, {}, never> extends infer Added extends {
						row: unknown
						names: string
						error: unknown
						rest: TokensList
				  }
				? [Added["error"]] extends [never]
					? Added["row"] extends Record<Added["names"], infer Definition>
						? [
								{
									readonly kind: "add_column"
									readonly ifNotExists: IfNotExists
									readonly name: Added["names"]
									readonly definition: Definition
								},
								Added["rest"],
							]
						: SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">
					: Added["error"]
				: SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">
		: SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionDropColumn<B extends TokensList> =
	ReadOptionalIfExists<B> extends [true, infer Rest extends TokensList]
		? ParseAlterActionDropColumnWithFlag<true, Rest>
		: ReadOptionalIfExists<B> extends [false, infer Rest extends TokensList]
			? ParseAlterActionDropColumnWithFlag<false, Rest>
			: ReadOptionalIfExists<B> extends [infer Error extends SqlParserError<string>, TokensList]
				? Error
				: SqlParserError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionDropColumnWithFlag<IfExists extends boolean, Rest extends TokensList> =
	ParseIdentifierToken<Rest> extends [infer Name extends string, infer Tail extends TokensList]
		? [
				{
					readonly kind: "drop_column"
					readonly ifExists: IfExists
					readonly name: Name
				},
				Tail,
			]
		: SqlParserError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionRenameTo<B extends TokensList> =
	ParseIdentifierToken<B> extends [infer Name extends string, infer Tail extends TokensList]
		? [
				{
					readonly kind: "rename_to"
					readonly name: Name
				},
				Tail,
			]
		: SqlParserError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterAddConstraint<B extends TokensList> =
	ReadExpectedIdentifier<B, "Expected constraint name in ALTER TABLE ADD CONSTRAINT"> extends [
		infer CName,
		infer Rest0 extends TokensList,
	]
		? CName extends SqlParserError<string>
			? CName
			: ParseAlterAddConstraintAfterName<Rest0>
		: SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">

type ParseAlterAddConstraintAfterName<Rest0 extends TokensList> =
	ReadConstraintEntryMatch<Rest0> extends [false, infer _, infer __]
		? SqlParserError<"Expected constraint definition in ALTER TABLE">
		: ReadConstraintEntryMatch<Rest0> extends [
					infer Kind extends string,
					infer _EB extends TokensList,
					infer AfterKw extends TokensList,
			  ]
			? ParseAlterAddConstraintByKind<Kind, AfterKw>
			: SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">

type ParseAlterAddConstraintByKind<Kind extends string, AfterKw extends TokensList> = Kind extends "foreign_key"
	? ParseForeignKeyMetaAndRest<AfterKw> extends [infer Meta, infer R3 extends TokensList]
		? Meta extends SqlParserError<string>
			? [Meta, R3]
			: Meta extends ForeignRefMeta
				? SkipStatement<R3> extends [SkippedStatement, infer RestFinal extends TokensList]
					? [{ readonly kind: "add_constraint_fk"; readonly refs: Meta }, RestFinal]
					: SkipStatement<R3> extends [infer Err extends SqlParserError<string>, infer _R]
						? [Err, R3]
						: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, R3]
				: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, R3]
		: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, AfterKw]
	: Kind extends "primary_key"
		? ReadFirstParenGroup<AfterKw> extends [infer Inner extends TokensList, infer Tail extends TokensList]
			? ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
				? SkipStatement<Tail> extends [SkippedStatement, infer RestFinal extends TokensList]
					? [{ readonly kind: "add_constraint_primary"; readonly columns: Cols }, RestFinal]
					: SkipStatement<Tail> extends [infer Err extends SqlParserError<string>, infer _R]
						? [Err, Tail]
						: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, Tail]
				: [SqlParserError<"Unable to parse PRIMARY KEY columns">, Tail]
			: [SqlParserError<"Expected column list for PRIMARY KEY">, AfterKw]
		: Kind extends "unique"
			? ReadFirstParenGroup<AfterKw> extends [infer Inner2 extends TokensList, infer Tail2 extends TokensList]
				? ParseColumnListToTuple<Inner2> extends [infer Cols2 extends readonly string[], infer __]
					? SkipStatement<Tail2> extends [SkippedStatement, infer RestFinal2 extends TokensList]
						? [{ readonly kind: "add_constraint_unique"; readonly columns: Cols2 }, RestFinal2]
						: SkipStatement<Tail2> extends [infer Err2 extends SqlParserError<string>, infer _R2]
							? [Err2, Tail2]
							: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, Tail2]
					: [SqlParserError<"Unable to parse UNIQUE columns">, Tail2]
				: [SqlParserError<"Expected column list for UNIQUE">, AfterKw]
			: Kind extends "other"
				? SqlParserError<"Unsupported ALTER TABLE action">
				: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterDropConstraint<B extends TokensList> =
	ReadOptionalIfExists<B> extends [infer IfExists extends boolean, infer Rest extends TokensList]
		? ParseIdentifierToken<Rest> extends [infer CName extends string, infer Tail extends TokensList]
			? [{ readonly kind: "drop_constraint"; readonly ifExists: IfExists; readonly name: CName }, Tail]
			: SqlParserError<"Unable to parse ALTER TABLE DROP CONSTRAINT">
		: SqlParserError<"Unable to parse ALTER TABLE DROP CONSTRAINT">

type ParseAlterActionRenameColumn<B extends TokensList> =
	ParseIdentifierToken<B> extends [infer From extends string, infer Tail1 extends TokensList]
		? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
				infer ToTokenResult,
				infer Tail2 extends TokensList,
			]
			? ToTokenResult extends SqlParserError<string>
				? SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">
				: ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends TokensList]
					? [
							{
								readonly kind: "rename_column"
								readonly from: From
								readonly to: To
							},
							Tail3,
						]
					: SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">
			: SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">
		: SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">

type ParseAlterTableTupleAfterTable<B extends TokensList> =
	ReadOptionalIfExists<B> extends [true, infer RestFlag extends TokensList]
		? ParseAlterTableWithFlag<true, RestFlag>
		: ReadOptionalIfExists<B> extends [false, infer RestFlag extends TokensList]
			? ParseAlterTableWithFlag<false, RestFlag>
			: ReadOptionalIfExists<B> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestFlag extends TokensList,
				  ]
				? [FlagError, RestFlag]
				: [SqlParserError<"Unable to parse ALTER TABLE statement">, B]

type ParseAlterTableWithFlag<IfExists extends boolean, B extends TokensList> =
	AlterTableAfterOptionalOnly<B> extends infer RestOnly extends TokensList
		? ReadQualifiedIdentifierFromBuffer<RestOnly> extends [
				infer Target extends SqlQualifiedIdentifier,
				infer RestName extends TokensList,
			]
			? ParseAlterAction<RestName> extends infer ActionResult
				? ActionResult extends SqlParserError<string>
					? [ActionResult, RestName]
					: ActionResult extends [infer Head, infer ActionRest extends TokensList]
						? Head extends SqlParserError<string>
							? [Head, ActionRest]
							: [
									{
										readonly kind: "alter_table"
										readonly ifExists: IfExists
										readonly target: Target
										readonly action: Head
									},
									ActionRest,
								]
						: [SqlParserError<"Unable to parse ALTER TABLE statement">, B]
				: [SqlParserError<"Unable to parse ALTER TABLE statement">, B]
			: [SqlParserError<"Unable to parse ALTER TABLE statement">, B]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, B]

/** `ONLY` may appear with different lexer casing; skip it before the qualified table name. */
type AlterTableAfterOptionalOnly<B extends TokensList> = Lowercase<PeekToken<B>> extends "only" ? SkipToken<B> : B
