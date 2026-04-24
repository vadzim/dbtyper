import type { AddColumn } from "./sql-column.ts"
import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadOptionalIfNotExists,
	ReadExpectedIdentifier,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type {
	ForeignRefMeta,
	ParseColumnList,
	ParseForeignKeyMetaAndRest,
	TryReadConstraintHead,
} from "./sql-constraints-fk.ts"
import type { PeekToken, SkipToken, TokensList, SqlParserError, TokenType } from "../../core/sql-tokens.ts"

export type AlterTableStatement = {
	kind: "alter_table"
	ifExists: boolean
	target: SqlQualifiedIdentifier
	action: SqlAlterTableAction
}

export type ParseAlterTable<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer RestFlag extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [RestFlag, FlagOrError]
			: FlagOrError extends true
				? ParseAlterTableWithFlag<RestFlag, true>
				: ParseAlterTableWithFlag<RestFlag, false>
		: never

type SqlAlterTableActionAddColumn = {
	kind: "add_column"
	ifNotExists: boolean
	name: string
	definition: unknown
}

type SqlAlterTableActionDropColumn = {
	kind: "drop_column"
	ifExists: boolean
	name: string
}

type SqlAlterTableActionRenameTo = {
	kind: "rename_to"
	name: string
}

type SqlAlterTableActionRenameColumn = {
	kind: "rename_column"
	from: string
	to: string
}

type SqlAlterTableActionAddConstraintFk = {
	kind: "add_constraint_fk"
	name: string
	refs: ForeignRefMeta
}

type SqlAlterTableActionAddConstraintPk = {
	kind: "add_constraint_primary"
	name: string
	columns: string[]
}

type SqlAlterTableActionAddConstraintUnique = {
	kind: "add_constraint_unique"
	name: string
	columns: string[]
}

type SqlAlterTableActionAlterColumnSetNotNull = {
	kind: "alter_column_set_not_null"
	name: string
}

type SqlAlterTableActionAlterColumnDropNotNull = {
	kind: "alter_column_drop_not_null"
	name: string
}

type SqlAlterTableActionDropConstraint = {
	kind: "drop_constraint"
	ifExists: boolean
	name: string
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
	| SqlAlterTableActionAlterColumnSetNotNull
	| SqlAlterTableActionAlterColumnDropNotNull

type ParseIdentifierToken<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [infer Rest extends TokensList, infer Name]
		? Name extends string
			? [Rest, Name]
			: [Rest, Extract<Name, SqlParserError<string>>]
		: never

type ParseAlterAction<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"">
		? [Tokens, SqlParserError<"Expected an ALTER TABLE action">]
		: PeekToken<Tokens> extends TokenType<infer Action extends string>
			? ParseAlterActionByHead<Tokens, Action>
			: never

type ParseAlterActionByHead<Tokens extends TokensList, Action extends string> = Action extends "add"
	? ParseAlterActionAdd<SkipToken<Tokens>>
	: Action extends "drop"
		? ParseAlterActionDrop<SkipToken<Tokens>>
		: Action extends "rename"
			? ParseAlterActionRename<SkipToken<Tokens>>
			: Action extends "alter"
				? ParseAlterActionAlter<SkipToken<Tokens>>
				: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionAdd<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"column">
		? ParseAlterActionAddColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends TokenType<"constraint">
			? ParseAlterAddConstraint<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionDrop<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"column">
		? ParseAlterActionDropColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends TokenType<"constraint">
			? ParseAlterDropConstraint<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionRename<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"to">
		? ParseAlterActionRenameTo<SkipToken<Tokens>>
		: PeekToken<Tokens> extends TokenType<"column">
			? ParseAlterActionRenameColumn<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionAlter<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "column", "Unable to parse ALTER COLUMN"> extends [
		infer AfterColumn extends TokensList,
		infer ColKwOk,
	]
		? ColKwOk extends true
			? ParseIdentifierToken<AfterColumn> extends [infer AfterId extends TokensList, infer ColName]
				? ColName extends string
					? PeekToken<AfterId> extends TokenType<"set">
						? ReadExpectedToken<SkipToken<AfterId>, "not", "Expected NOT after SET in ALTER COLUMN"> extends [
									infer AfterNot extends TokensList,
									infer NotOk,
								]
							? NotOk extends true
								? ReadExpectedToken<AfterNot, "null", "Expected NULL after NOT NULL"> extends [
										infer AfterNull extends TokensList,
										infer NullOk,
									]
									? NullOk extends true
										? [
												AfterNull,
												{
													kind: "alter_column_set_not_null"
													name: ColName
												},
											]
										: [AfterNull, Extract<NullOk, SqlParserError<string>>]
									: never
								: [AfterNot, Extract<NotOk, SqlParserError<string>>]
							: never
						: PeekToken<AfterId> extends TokenType<"drop">
							? ReadExpectedToken<SkipToken<AfterId>, "not", "Expected NOT after DROP in ALTER COLUMN"> extends [
									infer AfterNot2 extends TokensList,
									infer NotOk2,
								]
								? NotOk2 extends true
									? ReadExpectedToken<AfterNot2, "null", "Expected NULL after NOT in DROP NOT NULL"> extends [
											infer AfterNull2 extends TokensList,
											infer NullOk2,
										]
										? NullOk2 extends true
											? [
													AfterNull2,
													{
														kind: "alter_column_drop_not_null"
														name: ColName
													},
												]
											: [AfterNull2, Extract<NullOk2, SqlParserError<string>>]
										: never
									: [AfterNot2, Extract<NotOk2, SqlParserError<string>>]
								: never
							: [AfterId, SqlParserError<"Expected SET NOT NULL or DROP NOT NULL in ALTER COLUMN">]
				: [AfterId, Extract<ColName, SqlParserError<string>>]
			: never
		: [AfterColumn, Extract<ColKwOk, SqlParserError<string>>]
	: never

type ParseAlterActionAddColumn<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer Rest extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [Rest, FlagOrError]
			: FlagOrError extends true
				? ParseAlterActionAddColumnWithFlag<Rest, true>
				: ParseAlterActionAddColumnWithFlag<Rest, false>
		: never

type ParseAlterActionAddColumnWithFlag<Tokens extends TokensList, IfNotExists extends boolean> =
	PeekToken<Tokens> extends TokenType<"">
		? [Tokens, SqlParserError<"Expected a column definition in ALTER TABLE ADD COLUMN">]
		: AddColumn<Tokens, {}, never> extends [
					infer RestAfter extends TokensList,
					infer Added extends { row: unknown; names: string; error: unknown },
			  ]
			? [Added["error"]] extends [never]
				? Added["row"] extends Record<Added["names"], infer Definition>
					? [
							RestAfter,
							{
								kind: "add_column"
								ifNotExists: IfNotExists
								name: Added["names"]
								definition: Definition
							},
						]
					: [RestAfter, SqlParserError<"Unable to parse ALTER TABLE ADD COLUMN action">]
				: [RestAfter, Extract<Added["error"], SqlParserError<string>>]
			: never

type ParseAlterActionDropColumn<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [
		infer Rest extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [Rest, FlagOrError]
			: FlagOrError extends true
				? ParseAlterActionDropColumnWithFlag<Rest, true>
				: ParseAlterActionDropColumnWithFlag<Rest, false>
		: never

type ParseAlterActionDropColumnWithFlag<Tokens extends TokensList, IfExists extends boolean> =
	ParseIdentifierToken<Tokens> extends [infer Tail extends TokensList, infer Name]
		? Name extends string
			? [
					Tail,
					{
						kind: "drop_column"
						ifExists: IfExists
						name: Name
					},
				]
			: [Tail, Extract<Name, SqlParserError<string>>]
		: never

type ParseAlterActionRenameTo<Tokens extends TokensList> =
	ParseIdentifierToken<Tokens> extends [infer Tail extends TokensList, infer Name]
		? Name extends string
			? [
					Tail,
					{
						kind: "rename_to"
						name: Name
					},
				]
			: [Tail, Extract<Name, SqlParserError<string>>]
		: never

type ParseAlterAddConstraint<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Expected constraint name in ALTER TABLE ADD CONSTRAINT"> extends [
		infer Rest0 extends TokensList,
		infer CName,
	]
		? CName extends SqlParserError<string>
			? [Rest0, CName]
			: CName extends string
				? ParseAlterAddConstraintAfterName<Rest0, CName>
				: [Rest0, SqlParserError<"Expected constraint name in ALTER TABLE ADD CONSTRAINT">]
		: never

type ParseAlterAddConstraintAfterName<Tokens extends TokensList, CName extends string> =
	TryReadConstraintHead<Tokens> extends [infer RestHead extends TokensList, infer Head]
		? Head extends SqlParserError<string>
			? [RestHead, Head]
			: Head extends { kind: "yes"; constraintKind: infer K extends string }
				? ParseAlterAddConstraintByKind<RestHead, K, CName>
				: [RestHead, SqlParserError<"Expected constraint definition in ALTER TABLE">]
		: never

type ParseAlterAddConstraintByKind<Tokens extends TokensList, Kind extends string, CName extends string> = Kind extends "foreign_key"
	? ParseForeignKeyMetaAndRest<Tokens> extends [infer R3 extends TokensList, infer Meta]
		? Meta extends ForeignRefMeta
			? [R3, { kind: "add_constraint_fk"; name: CName; refs: Meta }]
			: [R3, Extract<Meta, SqlParserError<string>>]
		: never
	: Kind extends "primary_key"
		? ParseColumnList<Tokens> extends [infer Tail extends TokensList, infer Cols]
			? Cols extends string[]
				? [Tail, { kind: "add_constraint_primary"; name: CName; columns: Cols }]
				: [Tail, Extract<Cols, SqlParserError<string>>]
			: never
		: Kind extends "unique"
			? ParseColumnList<Tokens> extends [infer Tail extends TokensList, infer Cols]
				? Cols extends string[]
					? [Tail, { kind: "add_constraint_unique"; name: CName; columns: Cols }]
					: [Tail, Extract<Cols, SqlParserError<string>>]
				: never
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterDropConstraint<Tokens extends TokensList> =
	ReadOptionalIfExists<Tokens> extends [infer Rest extends TokensList, infer IfExists]
		? IfExists extends boolean
			? ParseIdentifierToken<Rest> extends [infer Tail extends TokensList, infer CName]
				? CName extends string
					? [
							Tail,
							{
								kind: "drop_constraint"
								ifExists: IfExists
								name: CName
							},
						]
					: [Tail, Extract<CName, SqlParserError<string>>]
				: never
			: [Rest, Extract<IfExists, SqlParserError<string>>]
		: never

type ParseAlterActionRenameColumn<Tokens extends TokensList> =
	ParseIdentifierToken<Tokens> extends [infer Tail1 extends TokensList, infer From]
		? From extends string
			? ReadExpectedToken<Tail1, "to", "Unable to parse ALTER TABLE RENAME COLUMN action"> extends [
					infer Tail2 extends TokensList,
					infer ToTokenResult,
				]
				? ToTokenResult extends SqlParserError<string>
					? [Tail2, SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">]
					: ParseIdentifierToken<Tail2> extends [infer Tail3 extends TokensList, infer To]
						? To extends string
							? [
									Tail3,
									{
										kind: "rename_column"
										from: From
										to: To
									},
								]
							: [Tail3, SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">]
						: never
				: never
			: [Tail1, SqlParserError<"Unable to parse ALTER TABLE RENAME COLUMN action">]
		: never

type ParseAlterTableWithFlag<Tokens extends TokensList, IfExists extends boolean> =
	ReadAlterTableTarget<Tokens> extends [
		infer RestName extends TokensList,
		infer TargetResult extends SqlQualifiedIdentifier | SqlParserError<string>,
	]
		? TargetResult extends SqlParserError<string>
			? [RestName, SqlParserError<"Expected an ALTER TABLE statement with a table target">]
			: ParseAlterAction<RestName> extends [infer ActionRest extends TokensList, infer Head]
				? Head extends SqlParserError<string>
					? [ActionRest, Head]
					: ConsumeStatementEnd<ActionRest> extends [
								infer Tail extends TokensList,
								infer EndOk extends boolean,
						  ]
						? EndOk extends true
							? [
									Tail,
									{
										kind: "alter_table"
										ifExists: IfExists
										target: TargetResult
										action: Head
									},
								]
							: [Tail, SqlParserError<"Expected statement end after ALTER TABLE action">]
						: never
				: never
		: never

type ReadAlterTableTarget<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"only">
		? ReadQualifiedIdentifierFromBuffer<SkipToken<Tokens>>
		: ReadQualifiedIdentifierFromBuffer<Tokens>
