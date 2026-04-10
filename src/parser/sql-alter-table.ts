import type { SqlParseError } from "./sql-parse-error.js"
import type { AddColumn } from "./sql-column.js"
import type {
	IsTokenRestEmpty,
	ReadExpectedToken,
	ReadIdentifier,
	ReadOptionalIfExists,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifier,
	SqlQualifiedIdentifier,
	StripIdentifierQuotes,
	Trim,
} from "./sql-parse-primitives.js"
import type { ReadToken } from "./sql-tokens.js"

export type SqlAlterTable<S extends string> =
	ReadToken<S> extends ["alter", infer AfterAlter extends string]
		? ReadToken<AfterAlter> extends ["table", string]
			? FinalizeAlterTable<ParseAlterTableTuple<S>>
			: never
		: never

type FinalizeAlterTable<T> = T extends [infer E extends SqlParseError<string>, string]
	? E
	: T extends [infer Result, infer Rest extends string]
		? IsTokenRestEmpty<Rest> extends true
			? Result
			: SqlParseError<"Expected an ALTER TABLE statement with a table target">
		: SqlParseError<"Expected an ALTER TABLE statement with a table target">

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

type ParseIdentifierToken<S extends string> =
	ReadIdentifier<S> extends [infer Raw extends string, infer Rest extends string]
		? [StripIdentifierQuotes<Raw>, Rest]
		: never

type ParseAlterAction<S extends string> =
	Trim<S> extends ""
		? SqlParseError<"Expected an ALTER TABLE action">
		: ReadExpectedToken<S, "add", "Expected an ALTER TABLE action"> extends [
				infer AddResult,
				infer AddRest extends string,
			]
			? AddResult extends SqlParseError<string>
				? ReadExpectedToken<S, "drop", "Expected an ALTER TABLE action"> extends [
						infer DropResult,
						infer DropRest extends string,
					]
					? DropResult extends SqlParseError<string>
						? ReadExpectedToken<S, "rename", "Expected an ALTER TABLE action"> extends [
								infer RenameResult,
								infer RenameRest extends string,
							]
							? RenameResult extends SqlParseError<string>
								? SqlParseError<"Unsupported ALTER TABLE action">
								: ParseAlterActionRename<RenameRest>
							: SqlParseError<"Unsupported ALTER TABLE action">
						: ParseAlterActionDrop<DropRest>
					: SqlParseError<"Unsupported ALTER TABLE action">
				: ParseAlterActionAdd<AddRest>
			: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAdd<S extends string> =
	ReadExpectedToken<S, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends string,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionAddColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<S extends string> =
	ReadExpectedToken<S, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends string,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionDropColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<S extends string> =
	ReadExpectedToken<S, "to", "Unsupported ALTER TABLE action"> extends [
		infer ToResult,
		infer ToTail extends string,
	]
		? ToResult extends SqlParseError<string>
			? ReadExpectedToken<S, "column", "Unsupported ALTER TABLE action"> extends [
					infer ColumnResult,
					infer ColumnTail extends string,
				]
				? ColumnResult extends SqlParseError<string>
					? SqlParseError<"Unsupported ALTER TABLE action">
					: ParseAlterActionRenameColumn<ColumnTail>
				: SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionRenameTo<ToTail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<S extends string> =
	ReadOptionalIfNotExists<Trim<S>> extends [true, infer Rest extends string]
		? ParseAlterActionAddColumnWithFlag<true, Rest>
		: ReadOptionalIfNotExists<Trim<S>> extends [false, infer Rest extends string]
			? ParseAlterActionAddColumnWithFlag<false, Rest>
			: ReadOptionalIfNotExists<Trim<S>> extends [infer Error extends SqlParseError<string>, string]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends string> =
	Trim<Rest> extends ""
		? SqlParseError<"Expected a column definition in ALTER TABLE ADD COLUMN">
		: AddColumn<Rest, {}, never> extends infer Added extends { row: unknown; names: string; error: unknown }
			? [Added["error"]] extends [never]
				? Added["row"] extends Record<Added["names"], infer Definition>
					? {
							readonly kind: "add_column"
							readonly ifNotExists: IfNotExists
							readonly name: Added["names"]
							readonly definition: Definition
						}
					: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">
				: Added["error"]
			: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionDropColumn<S extends string> =
	ReadOptionalIfExists<Trim<S>> extends [true, infer Rest extends string]
		? ParseAlterActionDropColumnWithFlag<true, Rest>
		: ReadOptionalIfExists<Trim<S>> extends [false, infer Rest extends string]
			? ParseAlterActionDropColumnWithFlag<false, Rest>
			: ReadOptionalIfExists<Trim<S>> extends [infer Error extends SqlParseError<string>, string]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionDropColumnWithFlag<IfExists extends boolean, Rest extends string> =
	ParseIdentifierToken<Rest> extends [infer Name extends string, infer Tail extends string]
		? Trim<Tail> extends ""
			? {
					readonly kind: "drop_column"
					readonly ifExists: IfExists
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionRenameTo<S extends string> =
	ParseIdentifierToken<Trim<S>> extends [infer Name extends string, infer Tail extends string]
		? Trim<Tail> extends ""
			? {
					readonly kind: "rename_to"
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterActionRenameColumn<S extends string> =
	ParseIdentifierToken<Trim<S>> extends [infer From extends string, infer Tail1 extends string]
		? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
				infer ToTokenResult,
				infer Tail2 extends string,
			]
			? ToTokenResult extends SqlParseError<string>
				? SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
				: ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends string]
					? Trim<Tail3> extends ""
						? {
								readonly kind: "rename_column"
								readonly from: From
								readonly to: To
							}
						: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
					: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
			: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">

type ParseAlterTableTuple<S extends string> =
	ReadExpectedToken<S, "alter", "Expected an ALTER TABLE statement with a table target"> extends [
		infer AlterResult,
		infer RestAlter extends string,
	]
		? AlterResult extends SqlParseError<string>
			? [AlterResult, RestAlter]
			: ReadExpectedToken<RestAlter, "table", "Expected an ALTER TABLE statement with a table target"> extends [
					infer TableResult,
					infer RestTable extends string,
				]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends string]
						? ParseAlterTableWithFlag<true, RestFlag, S>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends string]
							? ParseAlterTableWithFlag<false, RestFlag, S>
							: ReadOptionalIfExists<RestTable> extends [
									  infer FlagError extends SqlParseError<string>,
									  infer RestFlag extends string,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse ALTER TABLE statement">, S]
				: [SqlParseError<"Unable to parse ALTER TABLE statement">, S]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, S]

type ParseAlterTableWithFlag<IfExists extends boolean, S extends string, Fallback extends string> =
	ReadQualifiedIdentifier<S> extends [
		infer Target extends SqlQualifiedIdentifier,
		infer RestName extends string,
	]
		? ParseAlterAction<RestName> extends infer ActionResult
			? ActionResult extends SqlParseError<string>
				? [ActionResult, Trim<RestName>]
				: [
						{
							readonly kind: "alter_table"
							readonly ifExists: IfExists
							readonly target: Target
							readonly action: ActionResult
						},
						"",
					]
			: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
