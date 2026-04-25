import type { CreateTableStatement } from "../parser/parse-create-table.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike } from "./sql-database.ts"
import type { ValidateCreateTableFkRefs, ValidateCreateTableLocalRefs } from "./helpers/validate-fk-refs.ts"
import type { MergeSchemas, ResolveQualifiedIdentifier, SchemaExists, TableExists } from "./helpers/engine-helpers.ts"
import type {
	JsqlAddConstraint,
	JsqlColumnFactsEntry,
	JsqlTableColumnFactsKey,
	JsqlTableConstraintsKey,
} from "./table-constraint-meta.ts"

type TableRow<Row> = Extract<Row, Record<string, unknown>>
type DataColumns<Row> = Omit<TableRow<Row>, JsqlTableConstraintsKey | JsqlTableColumnFactsKey>

type ConstraintEntryFor<C extends { kind: "primary_key" | "unique"; columns: string[] }> =
	C["kind"] extends "primary_key"
		? { kind: "primary_key"; columns: C["columns"] }
		: { kind: "unique"; columns: C["columns"] }

type StripNamedConstraints<Constraints> = Constraints extends [
	infer H extends { kind: "primary_key" | "unique"; columns: string[] },
	...infer R extends { kind: "primary_key" | "unique"; columns: string[] }[],
]
	? [{ kind: H["kind"]; columns: H["columns"] }, ...StripNamedConstraints<R>]
	: Constraints extends []
		? []
		: []

type NamedConstraintList<Create extends CreateTableStatement> = Create extends {
	namedIntraTableConstraints: infer Named extends { kind: "primary_key" | "unique"; columns: string[] }[]
}
	? Named
	: []

type CombinedLocalConstraints<Create extends CreateTableStatement> = [
	...Create["intraTableConstraints"],
	...StripNamedConstraints<NamedConstraintList<Create>>,
]

type AddNamedConstraints<
	Row,
	Constraints extends { name: string; kind: "primary_key" | "unique"; columns: string[] }[],
> = Constraints extends [
	infer H extends { name: string; kind: "primary_key" | "unique"; columns: string[] },
	...infer R extends { name: string; kind: "primary_key" | "unique"; columns: string[] }[],
]
	? JsqlAddConstraint<Row, H["name"], ConstraintEntryFor<H>> extends infer Added
		? Added extends SqlParserError<string>
			? Added
			: AddNamedConstraints<Added, R>
		: SqlParserError<"Internal create table constraint metadata error">
	: Row

type AddColumnFacts<Row, Facts> = [Facts] extends [never]
	? Row
	: keyof Extract<Facts, Record<string, JsqlColumnFactsEntry>> extends never
		? Row
		: Row & { [K in JsqlTableColumnFactsKey]: Extract<Facts, Record<string, JsqlColumnFactsEntry>> }

export type ApplyCreateTable<
	Db extends SqlDatabaseLike,
	Create extends CreateTableStatement,
> = Create["name"] extends infer Name
	? Name extends SqlParserError<string>
		? Name
		: Name extends [string] | [string, string]
			? Create["row"] extends infer Row
				? Row extends SqlParserError<string>
					? Row
					: ResolveQualifiedIdentifier<Name, Db["defaultSchema"]> extends [
								infer Schema extends string,
								infer Table extends string,
						  ]
						? Db["schemas"] extends Record<string, Record<string, unknown>>
							? SchemaExists<
									Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
									Schema
								> extends true
								? TableExists<Db["schemas"], Schema, Table> extends true
									? SqlParserError<`Duplicate table name: ${Table}`>
									: ValidateCreateTableLocalRefs<
												Row,
												CombinedLocalConstraints<Create>,
												Create["refs"]
										  > extends infer LocalValidationError
										? [LocalValidationError] extends [never]
											? ValidateCreateTableFkRefs<
													Db,
													Create,
													Schema,
													Table
												> extends infer ValidationError
												? [ValidationError] extends [never]
													? AddNamedConstraints<
															TableRow<Row>,
															NamedConstraintList<Create>
														> extends infer WithConstraints
														? WithConstraints extends SqlParserError<string>
															? WithConstraints
															: {
																	kind: "database"
																	defaultSchema: Db["defaultSchema"]
																	schemas: MergeSchemas<
																		Extract<
																			Db["schemas"],
																			Record<string, Record<string, unknown>>
																		>,
																		Schema,
																		Table,
																		AddColumnFacts<
																			WithConstraints,
																			Create extends { columnFacts?: infer Facts }
																				? Facts
																				: never
																		>
																	>
																}
														: SqlParserError<"Internal SqlApplyCreateTable constraint metadata error">
													: ValidationError extends SqlParserError<string>
														? ValidationError
														: SqlParserError<"Internal SqlApplyCreateTable error">
												: SqlParserError<"Internal SqlApplyCreateTable error">
											: LocalValidationError extends SqlParserError<string>
												? LocalValidationError
												: SqlParserError<"Internal SqlApplyCreateTable error">
										: SqlParserError<"Internal SqlApplyCreateTable error">
								: SqlParserError<`Unknown schema "${Schema}" (use CREATE SCHEMA first)`>
							: SqlParserError<"Internal SqlApplyCreateTable schema shape error">
						: SqlParserError<"Internal SqlApplyCreateTable target error">
				: SqlParserError<"Internal SqlApplyCreateTable row error">
			: SqlParserError<"Internal SqlApplyCreateTable name error">
	: SqlParserError<"Internal SqlApplyCreateTable error">
