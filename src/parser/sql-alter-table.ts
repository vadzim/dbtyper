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
import type { Buffer, EmptyBuffer, ReadToken, SqlParseError } from "./sql-tokens.js"

export type SqlAlterTable<B extends Buffer> =
	ReadToken<B> extends ["alter", infer AfterAlter extends Buffer]
		? ReadToken<AfterAlter> extends ["table", Buffer]
			? FinalizeAlterTableTuple<ParseAlterTableTuple<B>>
			: never
		: never

type FinalizeAlterTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends Buffer]
	? [E, R]
	: T extends [infer Result, infer Rest extends Buffer]
		? ConsumeStatementEnd<Rest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
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

type ParseIdentifierToken<B extends Buffer> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [
		infer Name extends string,
		infer Rest extends Buffer,
	]
		? [Name, Rest]
		: never

type ParseAlterAction<B extends Buffer> = ReadBufferEnd<B> extends [infer AtEnd, infer Rem extends Buffer]
	? AtEnd extends true
		? SqlParseError<"Expected an ALTER TABLE action">
		: ReadExpectedToken<Rem, "add", "Expected an ALTER TABLE action"> extends [
					infer AddResult,
					infer AddRest extends Buffer,
			  ]
			? AddResult extends SqlParseError<string>
				? ReadExpectedToken<Rem, "drop", "Expected an ALTER TABLE action"> extends [
						infer DropResult,
						infer DropRest extends Buffer,
					]
					? DropResult extends SqlParseError<string>
						? ReadExpectedToken<Rem, "rename", "Expected an ALTER TABLE action"> extends [
								infer RenameResult,
								infer RenameRest extends Buffer,
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

type ParseAlterActionAdd<B extends Buffer> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends Buffer,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionAddColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionDrop<B extends Buffer> =
	ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
		infer ColumnResult,
		infer Tail extends Buffer,
	]
		? ColumnResult extends SqlParseError<string>
			? SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionDropColumn<Tail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionRename<B extends Buffer> =
	ReadExpectedToken<B, "to", "Unsupported ALTER TABLE action"> extends [infer ToResult, infer ToTail extends Buffer]
		? ToResult extends SqlParseError<string>
			? ReadExpectedToken<B, "column", "Unsupported ALTER TABLE action"> extends [
					infer ColumnResult,
					infer ColumnTail extends Buffer,
				]
				? ColumnResult extends SqlParseError<string>
					? SqlParseError<"Unsupported ALTER TABLE action">
					: ParseAlterActionRenameColumn<ColumnTail>
				: SqlParseError<"Unsupported ALTER TABLE action">
			: ParseAlterActionRenameTo<ToTail>
		: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<B extends Buffer> =
	ReadOptionalIfNotExists<B> extends [true, infer Rest extends Buffer]
		? ParseAlterActionAddColumnWithFlag<true, Rest>
		: ReadOptionalIfNotExists<B> extends [false, infer Rest extends Buffer]
			? ParseAlterActionAddColumnWithFlag<false, Rest>
			: ReadOptionalIfNotExists<B> extends [infer Error extends SqlParseError<string>, Buffer]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionAddColumnWithFlag<IfNotExists extends boolean, Rest extends Buffer> =
	ReadBufferEnd<Rest> extends [infer AtEnd, infer Rem extends Buffer]
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

type ParseAlterActionDropColumn<B extends Buffer> =
	ReadOptionalIfExists<B> extends [true, infer Rest extends Buffer]
		? ParseAlterActionDropColumnWithFlag<true, Rest>
		: ReadOptionalIfExists<B> extends [false, infer Rest extends Buffer]
			? ParseAlterActionDropColumnWithFlag<false, Rest>
			: ReadOptionalIfExists<B> extends [infer Error extends SqlParseError<string>, Buffer]
				? Error
				: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionDropColumnWithFlag<IfExists extends boolean, Rest extends Buffer> =
	ParseIdentifierToken<Rest> extends [infer Name extends string, infer Tail extends Buffer]
		? ReadBufferEnd<Tail> extends [true, infer _]
			? {
					readonly kind: "drop_column"
					readonly ifExists: IfExists
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">
		: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">

type ParseAlterActionRenameTo<B extends Buffer> =
	ParseIdentifierToken<B> extends [infer Name extends string, infer Tail extends Buffer]
		? ReadBufferEnd<Tail> extends [true, infer _]
			? {
					readonly kind: "rename_to"
					readonly name: Name
				}
			: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">
		: SqlParseError<"Unable to parse ALTER TABLE RENAME TO action">

type ParseAlterActionRenameColumn<B extends Buffer> =
	ParseIdentifierToken<B> extends [infer From extends string, infer Tail1 extends Buffer]
		? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
				infer ToTokenResult,
				infer Tail2 extends Buffer,
			]
			? ToTokenResult extends SqlParseError<string>
				? SqlParseError<"Unable to parse ALTER TABLE RENAME COLUMN action">
				: ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends Buffer]
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

type ParseAlterTableTuple<B extends Buffer> =
	ReadExpectedToken<B, "alter", "Expected an ALTER TABLE statement with a table target"> extends [
		infer AlterResult,
		infer RestAlter extends Buffer,
	]
		? AlterResult extends SqlParseError<string>
			? [AlterResult, RestAlter]
			: ReadExpectedToken<RestAlter, "table", "Expected an ALTER TABLE statement with a table target"> extends [
						infer TableResult,
						infer RestTable extends Buffer,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ReadOptionalIfExists<RestTable> extends [true, infer RestFlag extends Buffer]
						? ParseAlterTableWithFlag<true, RestFlag, B>
						: ReadOptionalIfExists<RestTable> extends [false, infer RestFlag extends Buffer]
							? ParseAlterTableWithFlag<false, RestFlag, B>
							: ReadOptionalIfExists<RestTable> extends [
										infer FlagError extends SqlParseError<string>,
										infer RestFlag extends Buffer,
								  ]
								? [FlagError, RestFlag]
								: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
				: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]
		: [SqlParseError<"Unable to parse ALTER TABLE statement">, B]

type ParseAlterTableWithFlag<IfExists extends boolean, B extends Buffer, Fallback extends Buffer> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Target extends SqlQualifiedIdentifier,
		infer RestName extends Buffer,
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
