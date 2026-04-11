import type { AddColumn } from "./sql-column.js"
import type {
	ConsumeStatementEnd,
	ReadBufferEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadOptionalIfNotExists,
	ReadExpectedIdentifier,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlAlterTable<B extends TokensList> =
	PeekToken<B> extends "alter"
		? PeekToken<SkipToken<B>> extends "table"
			? FinalizeAlterTableTuple<ParseAlterTableTuple<B>>
			: never
		: never

type FinalizeAlterTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer Result, infer Rest extends TokensList]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends TokensList]
			? [Result, Tail]
			: [SqlParseError<"Expected an ALTER TABLE statement with a table target">, Rest]
		: [SqlParseError<"Expected an ALTER TABLE statement with a table target">, EmptyTokenList]

export type SqlAlterTableLike = {
	readonly kind: "alter_table"
	readonly ifExists: boolean
	readonly target: SqlQualifiedIdentifier
	readonly action: SqlAlterTableAction
}

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

type SqlAlterTableAction =
	| SqlAlterTableActionAddColumn
	| SqlAlterTableActionDropColumn
	| SqlAlterTableActionRenameTo
	| SqlAlterTableActionRenameColumn

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
			? SqlParseError<"Expected an ALTER TABLE action">
			: ReadExpectedToken<Rem, "add", "Expected an ALTER TABLE action"> extends [
						infer AddResult,
						infer AddRest extends TokensList,
				  ]
				? AddResult extends SqlParseError<string>
					? ReadExpectedToken<Rem, "drop", "Expected an ALTER TABLE action"> extends [
							infer DropResult,
							infer DropRest extends TokensList,
						]
						? DropResult extends SqlParseError<string>
							? ReadExpectedToken<Rem, "rename", "Expected an ALTER TABLE action"> extends [
									infer RenameResult,
									infer RenameRest extends TokensList,
								]
								? RenameResult extends SqlParseError<string>
									? SqlParseError<"Unsupported ALTER TABLE action">
									: ParseAlterActionRename<RenameRest>
								: SqlParseError<"Unsupported ALTER TABLE action">
							: ParseAlterActionDrop<DropRest>
						: SqlParseError<"Unsupported ALTER TABLE action">
					: ParseAlterActionAdd<AddRest>
				: SqlParseError<"Unsupported ALTER TABLE action">
		: never

type ParseAlterActionAdd<B extends TokensList> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends TokensList,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionAddColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<B extends TokensList> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends TokensList,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionDropColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<B extends TokensList> =
	ReadExpectedToken<B, "to", "Unsupported ALTER TABLE action"> extends [
		infer ToResult,
		infer ToTail extends TokensList,
	]
		? ToResult extends SqlParseError<string>
			? ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
					infer ColumnResult,
					infer ColumnTail extends TokensList,
				]
				? ColumnResult extends SqlParseError<string>
					? SqlParseError<"Unsupported ALTER TABLE action">
					: ParseAlterActionRenameColumn<ColumnTail>
				: SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionRenameTo<ToTail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<B extends TokensList> =
	ReadOptionalIfNotExists<B> extends [true, infer Rest extends TokensList]
		? ParseAlterActionAddColumnWithFlag<true, Rest>
		: ReadOptionalIfNotExists<B> extends [false, infer Rest extends TokensList]
			? ParseAlterActionAddColumnWithFlag<false, Rest>
			: ReadOptionalIfNotExists<B> extends [infer Error extends SqlParseError<string>, TokensList]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends TokensList> =
	ReadBufferEnd<Rest> extends [infer AtEnd, infer Rem extends TokensList]
		? AtEnd extends true
			? SqlParseError<"Expected a column definition in ALTER TABLE ADD COLUMN">
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
						: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">
					: Added["error"]
				: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionDropColumn<B extends TokensList> =
	ReadOptionalIfExists<B> extends [true, infer Rest extends TokensList]
		? ParseAlterActionDropColumnWithFlag<true, Rest>
		: ReadOptionalIfExists<B> extends [false, infer Rest extends TokensList]
			? ParseAlterActionDropColumnWithFlag<false, Rest>
			: ReadOptionalIfExists<B> extends [infer Error extends SqlParseError<string>, TokensList]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

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
		: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionRenameTo<B extends TokensList> =
	ParseIdentifierToken<B> extends [infer Name extends string, infer Tail extends TokensList]
		? [
				{
					readonly kind: "rename_to"
					readonly name: Name
				},
				Tail,
			]
		: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterActionRenameColumn<B extends TokensList> =
	ParseIdentifierToken<B> extends [infer From extends string, infer Tail1 extends TokensList]
		? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
				infer ToTokenResult,
				infer Tail2 extends TokensList,
			]
			? ToTokenResult extends SqlParseError<string>
				? SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
				: ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends TokensList]
					? [
							{
								readonly kind: "rename_column"
								readonly from: From
								readonly to: To
							},
							Tail3,
						]
					: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
			: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">

type ParseAlterTableTuple<B extends TokensList> =
	ReadExpectedToken<B, "alter", "Expected an ALTER TABLE statement with a table target"> extends [
		infer AlterResult,
		infer RestAlter extends TokensList,
	]
		? AlterResult extends SqlParseError<string>
			? [AlterResult, RestAlter]
			: ReadExpectedToken<RestAlter, "table", "Expected an ALTER TABLE statement with a table target"> extends [
						infer TableResult,
						infer RestTable extends TokensList,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends TokensList]
						? ParseAlterTableWithFlag<true, RestFlag, B>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends TokensList]
							? ParseAlterTableWithFlag<false, RestFlag, B>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends TokensList,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
				: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]

type ParseAlterTableWithFlag<IfExists extends boolean, B extends TokensList, Fallback extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Target extends SqlQualifiedIdentifier,
		infer RestName extends TokensList,
	]
		? ParseAlterAction<RestName> extends infer ActionResult
			? ActionResult extends SqlParseError<string>
				? [ActionResult, RestName]
				: ActionResult extends [infer Action, infer ActionRest extends TokensList]
					? [
							{
								readonly kind: "alter_table"
								readonly ifExists: IfExists
								readonly target: Target
								readonly action: Action
							},
							ActionRest,
						]
					: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
			: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
