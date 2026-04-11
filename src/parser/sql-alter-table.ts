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
import type { BufferLike, EmptyBuffer, ReadToken, SqlParseError } from "./sql-tokens.js"

export type SqlAlterTable<B extends BufferLike> =
	ReadToken<B> extends ["alter", infer AfterAlter extends BufferLike]
		? ReadToken<AfterAlter> extends ["table", BufferLike]
			? FinalizeAlterTableTuple<ParseAlterTableTuple<B>>
			: never
		: never

type FinalizeAlterTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends BufferLike]
	? [E, R]
	: T extends [infer Result, infer Rest extends BufferLike]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends BufferLike]
			? ReadToken<Tail> extends ["", BufferLike]
				? [Result, Tail]
				: [SqlParseError<"Expected an ALTER TABLE statement with a table target">, Rest]
			: [SqlParseError<"Expected an ALTER TABLE statement with a table target">, Rest]
		: [SqlParseError<"Expected an ALTER TABLE statement with a table target">, EmptyBuffer]

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

type ParseIdentifierToken<B extends BufferLike> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [
		infer Name extends string,
		infer Rest extends BufferLike,
	]
		? [Name, Rest]
		: never

type ParseAlterAction<B extends BufferLike> =
	ReadBufferEnd<B> extends [infer AtEnd, infer Rem extends BufferLike]
		? AtEnd extends true
			? SqlParseError<"Expected an ALTER TABLE action">
			: ReadExpectedToken<Rem, "add", "Expected an ALTER TABLE action"> extends [
						infer AddResult,
						infer AddRest extends BufferLike,
				  ]
				? AddResult extends SqlParseError<string>
					? ReadExpectedToken<Rem, "drop", "Expected an ALTER TABLE action"> extends [
							infer DropResult,
							infer DropRest extends BufferLike,
						]
						? DropResult extends SqlParseError<string>
							? ReadExpectedToken<Rem, "rename", "Expected an ALTER TABLE action"> extends [
									infer RenameResult,
									infer RenameRest extends BufferLike,
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

type ParseAlterActionAdd<B extends BufferLike> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends BufferLike,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionAddColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<B extends BufferLike> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends BufferLike,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionDropColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<B extends BufferLike> =
	ReadExpectedToken<B, "to", "Unsupported ALTER TABLE action"> extends [
		infer ToResult,
		infer ToTail extends BufferLike,
	]
		? ToResult extends SqlParseError<string>
			? ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
					infer ColumnResult,
					infer ColumnTail extends BufferLike,
				]
				? ColumnResult extends SqlParseError<string>
					? SqlParseError<"Unsupported ALTER TABLE action">
					: ParseAlterActionRenameColumn<ColumnTail>
				: SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionRenameTo<ToTail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<B extends BufferLike> =
	ReadOptionalIfNotExists<B> extends [true, infer Rest extends BufferLike]
		? ParseAlterActionAddColumnWithFlag<true, Rest>
		: ReadOptionalIfNotExists<B> extends [false, infer Rest extends BufferLike]
			? ParseAlterActionAddColumnWithFlag<false, Rest>
			: ReadOptionalIfNotExists<B> extends [infer Error extends SqlParseError<string>, BufferLike]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends BufferLike> =
	ReadBufferEnd<Rest> extends [infer AtEnd, infer Rem extends BufferLike]
		? AtEnd extends true
			? SqlParseError<"Expected a column definition in ALTER TABLE ADD COLUMN">
			: AddColumn<Rem, {}, never> extends infer Added extends {
						row: unknown
						names: string
						error: unknown
				  }
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
		: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionDropColumn<B extends BufferLike> =
	ReadOptionalIfExists<B> extends [true, infer Rest extends BufferLike]
		? ParseAlterActionDropColumnWithFlag<true, Rest>
		: ReadOptionalIfExists<B> extends [false, infer Rest extends BufferLike]
			? ParseAlterActionDropColumnWithFlag<false, Rest>
			: ReadOptionalIfExists<B> extends [infer Error extends SqlParseError<string>, BufferLike]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionDropColumnWithFlag<IfExists extends boolean, Rest extends BufferLike> =
	ParseIdentifierToken<Rest> extends [infer Name extends string, infer Tail extends BufferLike]
		? ReadBufferEnd<Tail> extends [true, infer _]
			? {
					readonly kind: "drop_column"
					readonly ifExists: IfExists
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionRenameTo<B extends BufferLike> =
	ParseIdentifierToken<B> extends [infer Name extends string, infer Tail extends BufferLike]
		? ReadBufferEnd<Tail> extends [true, infer _]
			? {
					readonly kind: "rename_to"
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterActionRenameColumn<B extends BufferLike> =
	ParseIdentifierToken<B> extends [infer From extends string, infer Tail1 extends BufferLike]
		? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
				infer ToTokenResult,
				infer Tail2 extends BufferLike,
			]
			? ToTokenResult extends SqlParseError<string>
				? SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
				: ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends BufferLike]
					? ReadBufferEnd<Tail3> extends [true, infer __]
						? {
								readonly kind: "rename_column"
								readonly from: From
								readonly to: To
							}
						: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
					: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
			: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">

type ParseAlterTableTuple<B extends BufferLike> =
	ReadExpectedToken<B, "alter", "Expected an ALTER TABLE statement with a table target"> extends [
		infer AlterResult,
		infer RestAlter extends BufferLike,
	]
		? AlterResult extends SqlParseError<string>
			? [AlterResult, RestAlter]
			: ReadExpectedToken<RestAlter, "table", "Expected an ALTER TABLE statement with a table target"> extends [
						infer TableResult,
						infer RestTable extends BufferLike,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends BufferLike]
						? ParseAlterTableWithFlag<true, RestFlag, B>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends BufferLike]
							? ParseAlterTableWithFlag<false, RestFlag, B>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends BufferLike,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
				: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]

type ParseAlterTableWithFlag<IfExists extends boolean, B extends BufferLike, Fallback extends BufferLike> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Target extends SqlQualifiedIdentifier,
		infer RestName extends BufferLike,
	]
		? ParseAlterAction<RestName> extends infer ActionResult
			? ActionResult extends SqlParseError<string>
				? [ActionResult, RestName]
				: [
						{
							readonly kind: "alter_table"
							readonly ifExists: IfExists
							readonly target: Target
							readonly action: ActionResult
						},
						EmptyBuffer,
					]
			: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, Fallback]
