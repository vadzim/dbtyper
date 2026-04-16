import type { AddColumn } from "./sql-column.ts"
import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadOptionalIfExists,
	ReadOptionalIfNotExists,
	ReadExpectedIdentifier,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type {
	ForeignRefMeta,
	ParseColumnListToTuple,
	ParseForeignKeyMetaAndRest,
	TryReadConstraintHead,
} from "./sql-constraints-fk.ts"
import type { SkipStatement, SkippedStatement } from "./skip-statement.ts"
import type { PeekToken, SkipToken, TokensList, SqlParserError, ParseSqlTokens } from "../../core/sql-tokens.ts"

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
	refs: ForeignRefMeta
}

type SqlAlterTableActionAddConstraintPk = {
	kind: "add_constraint_primary"
	columns: string[]
}

type SqlAlterTableActionAddConstraintUnique = {
	kind: "add_constraint_unique"
	columns: string[]
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

type ParseIdentifierToken<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [infer Rest extends TokensList, infer Name]
		? Name extends string
			? [Rest, Name]
			: [Rest, Extract<Name, SqlParserError<string>>]
		: never

type ParseAlterAction<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [Tokens, SqlParserError<"Expected an ALTER TABLE action">]
		: PeekToken<Tokens> extends infer Action extends string
			? ParseAlterActionByHead<Tokens, Action>
			: never

type ParseAlterActionByHead<Tokens extends TokensList, Action extends string> = Action extends "add"
	? ParseAlterActionAdd<SkipToken<Tokens>>
	: Action extends "drop"
		? ParseAlterActionDrop<SkipToken<Tokens>>
		: Action extends "rename"
			? ParseAlterActionRename<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionAdd<Tokens extends TokensList> =
	PeekToken<Tokens> extends "column"
		? ParseAlterActionAddColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "constraint"
			? ParseAlterAddConstraint<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionDrop<Tokens extends TokensList> =
	PeekToken<Tokens> extends "column"
		? ParseAlterActionDropColumn<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "constraint"
			? ParseAlterDropConstraint<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

type ParseAlterActionRename<Tokens extends TokensList> =
	PeekToken<Tokens> extends "to"
		? ParseAlterActionRenameTo<SkipToken<Tokens>>
		: PeekToken<Tokens> extends "column"
			? ParseAlterActionRenameColumn<SkipToken<Tokens>>
			: [Tokens, SqlParserError<"Unsupported ALTER TABLE action">]

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
	PeekToken<Tokens> extends ""
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
			: ParseAlterAddConstraintAfterName<Rest0>
		: never

type ParseAlterAddConstraintAfterName<Tokens extends TokensList> =
	TryReadConstraintHead<Tokens> extends [infer RestHead extends TokensList, infer Head]
		? Head extends SqlParserError<string>
			? [RestHead, Head]
			: Head extends { kind: "yes"; constraintKind: infer K extends string }
				? ParseAlterAddConstraintByKind<RestHead, K>
				: [RestHead, SqlParserError<"Expected constraint definition in ALTER TABLE">]
		: never

type ParseAlterAddConstraintByKind<Tokens extends TokensList, Kind extends string> = Kind extends "foreign_key"
	? ParseForeignKeyMetaAndRest<Tokens> extends [infer R3 extends TokensList, infer Meta]
		? Meta extends ForeignRefMeta
			? SkipStatement<R3> extends [infer RestFinal extends TokensList, infer SkipResult]
				? SkipResult extends SkippedStatement
					? [RestFinal, { kind: "add_constraint_fk"; refs: Meta }]
					: [RestFinal, SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">]
				: never
			: [R3, Extract<Meta, SqlParserError<string>>]
		: never
	: Kind extends "primary_key"
		? ReadFirstParenGroup<Tokens> extends [infer Tail extends TokensList, infer Inner extends string]
			? ParseColumnListToTuple<ParseSqlTokens<Inner>> extends [infer _RestCols extends TokensList, infer Cols]
				? Cols extends string[]
					? SkipStatement<Tail> extends [infer RestFinal extends TokensList, infer SkipResult]
						? SkipResult extends SkippedStatement
							? [RestFinal, { kind: "add_constraint_primary"; columns: Cols }]
							: [RestFinal, SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">]
						: never
					: [Tail, Extract<Cols, SqlParserError<string>>]
				: never
			: never
		: Kind extends "unique"
			? ReadFirstParenGroup<Tokens> extends [infer Tail extends TokensList, infer Inner extends string]
				? ParseColumnListToTuple<ParseSqlTokens<Inner>> extends [infer _RestCols extends TokensList, infer Cols]
					? Cols extends string[]
						? SkipStatement<Tail> extends [infer RestFinal extends TokensList, infer SkipResult]
							? SkipResult extends SkippedStatement
								? [RestFinal, { kind: "add_constraint_unique"; columns: Cols }]
								: [RestFinal, SqlParserError<"Unable to parse ALTER TABLE ADD CONSTRAINT">]
							: never
						: [Tail, Extract<Cols, SqlParserError<string>>]
					: never
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
	Lowercase<PeekToken<Tokens>> extends "only"
		? ReadQualifiedIdentifierFromBuffer<SkipToken<Tokens>>
		: ReadQualifiedIdentifierFromBuffer<Tokens>
