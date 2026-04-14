import type { AddColumn } from "./sql-column.js"
import type {
	ConsumeStatementEnd,
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
	TryReadConstraintHead,
} from "./sql-constraints-fk.js"
import type { SkipStatement, SkippedStatement } from "./skip-statement.js"
import type { PeekToken, SkipToken, TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type AlterTableStatement = {
	readonly kind: "alter_table"
	readonly ifExists: boolean
	readonly target: SqlQualifiedIdentifier
	readonly action: SqlAlterTableAction
}

/** `Tokens` is immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseAlterTable<Tokens extends TokensList> = FinalizeAlterTableTuple<ParseAlterTableTupleAfterTable<Tokens>>

type FinalizeAlterTableTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends TokensList]
			? [Result, Tail]
			: [SqlParserError<"Expected an ALTER TABLE statement with a table target">, EmptyTokenList]
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

type ParseIdentifierToken<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [
		infer Name extends string,
		infer Rest extends TokensList,
	]
		? [Name, Rest]
		: never

type ParseAlterAction<Tokens extends TokensList> = PeekToken<Tokens> extends ""
	? SqlParserError<"Expected an ALTER TABLE action">
	: PeekToken<Tokens> extends infer Action extends string
		? ParseAlterActionByHead<Action, Tokens>
		: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionByHead<Action extends string, Tokens extends TokensList> = Action extends "add"
	? ParseAlterActionAdd<SkipToken<Tokens>>
	: Action extends "drop"
		? ParseAlterActionDrop<SkipToken<Tokens>>
		: Action extends "rename"
			? ParseAlterActionRename<SkipToken<Tokens>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionAdd<Tokens extends TokensList> =
	PeekToken<Tokens> extends "column"
		? ParseAlterActionAddColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "constraint"
			? ParseAlterAddConstraint<SkipToken<Tokens>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<Tokens extends TokensList> =
	PeekToken<Tokens> extends "column"
		? ParseAlterActionDropColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "constraint"
			? ParseAlterDropConstraint<SkipToken<Tokens>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<Tokens extends TokensList> =
	PeekToken<Tokens> extends "to"
		? ParseAlterActionRenameTo<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "column"
			? ParseAlterActionRenameColumn<SkipToken<Tokens>>
			: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<Tokens extends TokensList> =
	ReadOptionalIfNotExistsOnce<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer Rest extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? FlagOrError
			: FlagOrError extends true
				? ParseAlterActionAddColumnWithFlag<true, Rest>
				: ParseAlterActionAddColumnWithFlag<false, Rest>
		: SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends TokensList> =
	PeekToken<Rest> extends ""
		? SqlParserError<"Expected a column definition in ALTER TABLE ADD COLUMN">
		: AddColumn<Rest, {}, never> extends infer Added extends {
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

type ParseAlterActionDropColumn<Tokens extends TokensList> =
	ReadOptionalIfExistsOnce<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer Rest extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? FlagOrError
			: FlagOrError extends true
				? ParseAlterActionDropColumnWithFlag<true, Rest>
				: ParseAlterActionDropColumnWithFlag<false, Rest>
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

type ParseAlterActionRenameTo<Tokens extends TokensList> =
	ParseIdentifierToken<Tokens> extends [infer Name extends string, infer Tail extends TokensList]
		? [
				{
					readonly kind: "rename_to"
					readonly name: Name
				},
				Tail,
			]
		: SqlParserError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterAddConstraint<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Expected constraint name in ALTER TABLE ADD CONSTRAINT"> extends [
		infer CName,
		infer Rest0 extends TokensList,
	]
		? CName extends SqlParserError<string>
			? CName
			: ParseAlterAddConstraintAfterName<Rest0>
		: SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">

type ParseAlterAddConstraintAfterName<Rest0 extends TokensList> =
	TryReadConstraintHead<Rest0> extends infer H
		? H extends readonly ["no", infer _]
			? SqlParserError<"Expected constraint definition in ALTER TABLE">
			: H extends readonly ["err", infer E extends SqlParserError<string>, infer _R]
				? E
				: H extends readonly ["yes", infer P extends { kind: string; afterKw: TokensList }]
					? ParseAlterAddConstraintByKind<P["kind"], P["afterKw"]>
					: SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">
		: SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">

type ParseAlterAddConstraintByKind<Kind extends string, AfterKw extends TokensList> = Kind extends "foreign_key"
	? ParseForeignKeyMetaAndRest<AfterKw> extends [infer Meta, infer R3 extends TokensList]
		? Meta extends SqlParserError<string>
			? [Meta, R3]
			: Meta extends ForeignRefMeta
				? SkipStatement<R3> extends [SkippedStatement, infer RestFinal extends TokensList]
					? [{ readonly kind: "add_constraint_fk"; readonly refs: Meta }, RestFinal]
					: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, EmptyTokenList]
				: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, EmptyTokenList]
		: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, EmptyTokenList]
	: Kind extends "primary_key"
		? ReadFirstParenGroup<AfterKw> extends [infer Inner extends TokensList, infer Tail extends TokensList]
			? ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
				? SkipStatement<Tail> extends [SkippedStatement, infer RestFinal extends TokensList]
					? [{ readonly kind: "add_constraint_primary"; readonly columns: Cols }, RestFinal]
					: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, EmptyTokenList]
				: [SqlParserError<"Unable to parse PRIMARY KEY columns">, EmptyTokenList]
			: [SqlParserError<"Expected column list for PRIMARY KEY">, EmptyTokenList]
		: Kind extends "unique"
			? ReadFirstParenGroup<AfterKw> extends [infer Inner2 extends TokensList, infer Tail2 extends TokensList]
				? ParseColumnListToTuple<Inner2> extends [infer Cols2 extends readonly string[], infer __]
					? SkipStatement<Tail2> extends [SkippedStatement, infer RestFinal2 extends TokensList]
						? [{ readonly kind: "add_constraint_unique"; readonly columns: Cols2 }, RestFinal2]
						: [SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">, EmptyTokenList]
					: [SqlParserError<"Unable to parse UNIQUE columns">, EmptyTokenList]
				: [SqlParserError<"Expected column list for UNIQUE">, EmptyTokenList]
			: Kind extends "other"
				? SqlParserError<"Unsupported ALTER TABLE action">
				: SqlParserError<"Unsupported ALTER TABLE action">

type ParseAlterDropConstraint<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [infer IfExists extends boolean, infer Rest extends TokensList]
		? ParseIdentifierToken<Rest> extends [infer CName extends string, infer Tail extends TokensList]
			? [{ readonly kind: "drop_constraint"; readonly ifExists: IfExists; readonly name: CName }, Tail]
			: SqlParserError<"Unable to parse ALTER TABLE DROP CONSTRAINT">
		: SqlParserError<"Unable to parse ALTER TABLE DROP CONSTRAINT">

type ParseAlterActionRenameColumn<Tokens extends TokensList> =
	ParseIdentifierToken<Tokens> extends [infer From extends string, infer Tail1 extends TokensList]
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

type ParseAlterTableTupleAfterTable<Tokens extends TokensList> =
	ReadOptionalIfExistsOnce<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer RestFlag extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? [FlagOrError, RestFlag]
			: FlagOrError extends true
				? ParseAlterTableWithFlag<true, RestFlag>
				: ParseAlterTableWithFlag<false, RestFlag>
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]

type ParseAlterTableWithFlag<IfExists extends boolean, Tokens extends TokensList> =
	AlterTableAfterOptionalOnly<Tokens> extends infer RestOnly extends TokensList
		? ReadQualifiedIdentifierFromBuffer<RestOnly> extends [
				infer Target extends SqlQualifiedIdentifier,
				infer RestName extends TokensList,
			]
			? ParseAlterAction<RestName> extends infer ActionResult
				? ActionResult extends SqlParserError<string>
					? [ActionResult, EmptyTokenList]
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
						: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]
				: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]
			: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]

/** `ONLY` may appear with different lexer casing; skip it before the qualified table name. */
type AlterTableAfterOptionalOnly<Tokens extends TokensList> =
	Lowercase<PeekToken<Tokens>> extends "only" ? SkipToken<Tokens> : Tokens

type ReadOptionalIfExistsOnce<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer Rest extends TokensList,
	]
		? [FlagOrError, Rest]
		: [SqlParserError<"Unable to parse ALTER TABLE statement">, EmptyTokenList]

type ReadOptionalIfNotExistsOnce<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer Rest extends TokensList,
	]
		? [FlagOrError, Rest]
		: [SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">, EmptyTokenList]
