import type { SqlParseError } from "./sql-parse-error.js"
import type { AddColumn } from "./sql-column.js"
import type {
	NormalizeSql,
	ReadIdentifier,
	ReadQualifiedIdentifier,
	SqlQualifiedIdentifier,
	StripIdentifierQuotes,
	StripLeadingIfExists,
	StripLeadingIfNotExists,
	ToLower,
	Trim,
} from "./sql-parse-primitives.js"

export type SqlAlterTable<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table ${infer Body extends string}`
		? ParseAlterTableParts<Body> extends infer Parts
			? Parts extends SqlParseError<infer E>
				? SqlParseError<E>
				: Parts extends [
							infer IfExists extends boolean,
							infer Target extends SqlQualifiedIdentifier,
							infer Action extends SqlAlterTableAction,
					  ]
					? {
							readonly kind: "alter_table"
							readonly ifExists: IfExists
							readonly target: Target
							readonly action: Action
							readonly source: S
						}
					: SqlParseError<"Expected an ALTER TABLE statement with a table target">
			: SqlParseError<"Expected an ALTER TABLE statement with a table target">
		: never

export type SqlAlterTableLike = {
	readonly kind: "alter_table"
	readonly ifExists: boolean
	readonly target: SqlQualifiedIdentifier
	readonly action: SqlAlterTableAction
	readonly source: string
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
		: ToLower<Trim<S>> extends `add column ${infer Tail}`
			? ParseAlterActionAddColumn<Tail>
			: ToLower<Trim<S>> extends `drop column ${infer Tail}`
				? ParseAlterActionDropColumn<Tail>
				: ToLower<Trim<S>> extends `rename to ${infer Tail}`
					? ParseAlterActionRenameTo<Tail>
					: ToLower<Trim<S>> extends `rename column ${infer Tail}`
						? ParseAlterActionRenameColumn<Tail>
						: SqlParseError<"Unsupported ALTER TABLE action">

type ParseAlterActionAddColumn<S extends string> =
	StripLeadingIfNotExists<Trim<S>> extends [infer IfNotExists extends boolean, infer Rest extends string]
		? Trim<Rest> extends ""
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
		: SqlParseError<"Unable to parse ALTER TABLE ADD COLUMN action">

type ParseAlterActionDropColumn<S extends string> =
	StripLeadingIfExists<Trim<S>> extends [infer IfExists extends boolean, infer Rest extends string]
		? ParseIdentifierToken<Rest> extends [infer Name extends string, infer Tail extends string]
			? Trim<Tail> extends ""
				? {
						readonly kind: "drop_column"
						readonly ifExists: IfExists
						readonly name: Name
					}
				: SqlParseError<"Unable to parse ALTER TABLE DROP COLUMN action">
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
		? ToLower<Trim<Tail1>> extends `to ${infer Tail2}`
			? ParseIdentifierToken<Tail2> extends [infer To extends string, infer Tail3 extends string]
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

type ParseAlterTableParts<Body extends string> =
	StripLeadingIfExists<Body> extends [infer IfExists extends boolean, infer RestAfterFlag extends string]
		? ReadQualifiedIdentifier<RestAfterFlag> extends [
				infer Name extends SqlQualifiedIdentifier,
				infer Tail extends string,
			]
			? ParseAlterAction<Tail> extends infer ParsedAction
				? ParsedAction extends SqlParseError<string>
					? ParsedAction
					: [IfExists, Name, ParsedAction]
				: SqlParseError<"Unable to parse ALTER TABLE statement">
			: SqlParseError<"Unable to parse ALTER TABLE statement">
		: never
