import type { ForeignRefMeta } from "../parser/sql-constraints-fk.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"

export type JsqlConstraintEntry =
	| { kind: "primary_key"; columns: string[] }
	| { kind: "unique"; columns: string[] }
	| { kind: "foreign_key"; refs: ForeignRefMeta }

type JsqlConstraintMap = { [K: string]: JsqlConstraintEntry }
export type JsqlColumnFactsEntry = {
	default?: true
	check?: true
	generated?: true | { mode: "stored" | "virtual" }
}

type JsqlColumnFactsMap = { [K: string]: JsqlColumnFactsEntry }

export type JsqlGetConstraintMap<Table> = Table extends { constraints: infer M }
	? M extends JsqlConstraintMap
		? M
		: {}
	: {}

export type JsqlGetColumnFactsMap<Table> = Table extends { column_facts: infer M }
	? M extends JsqlColumnFactsMap
		? M
		: {}
	: {}

type JsqlHasConstraint<Table, Name extends string> = Name extends keyof JsqlGetConstraintMap<Table>
	? JsqlGetConstraintMap<Table>[Name] extends JsqlConstraintEntry
		? true
		: false
	: false

type JsqlMapAfterDrop<Table, Name extends string> = Omit<JsqlGetConstraintMap<Table>, Name>

/** `Exclude<keyof M, k>` is `never` when `k` is the only key (or the map is empty, which cannot happen with Has). */
type JsqlMapHasKeysOtherThan<Table, Name extends string> =
	JsqlGetConstraintMap<Table> extends infer M
		? M extends JsqlConstraintMap
			? [Exclude<keyof M, Name>] extends [never]
				? false
				: true
			: false
		: false

type MergeWithOptionalMeta<Table extends { columns: unknown }, NextConstraints extends JsqlConstraintMap> = {
	columns: Table["columns"]
	constraints: NextConstraints
} & (Table extends { column_facts: infer F extends JsqlColumnFactsMap } ? { column_facts: F } : unknown)

export type JsqlAddConstraint<
	Table extends { columns: unknown },
	Name extends string,
	Entry extends JsqlConstraintEntry,
> =
	JsqlHasConstraint<Table, Name> extends true
		? SqlParserError<`Duplicate constraint name: ${Name & string}`>
		: MergeWithOptionalMeta<Table, JsqlGetConstraintMap<Table> & { [K in Name]: Entry }>

export type JsqlDropConstraint<Table extends { columns: unknown }, Name extends string, IfExists extends boolean> =
	JsqlHasConstraint<Table, Name> extends true
		? JsqlMapHasKeysOtherThan<Table, Name> extends true
			? {
					columns: Table["columns"]
				} & {
					constraints: JsqlMapAfterDrop<Table, Name>
				} & (Table extends { column_facts: infer F extends JsqlColumnFactsMap } ? { column_facts: F } : unknown)
			: Omit<Table, "constraints">
		: IfExists extends true
			? Table
			: SqlParserError<`Unknown constraint "${Name & string}" in table`>

type JsqlColumnFactsAfterDrop<Table, Name extends string> = Omit<JsqlGetColumnFactsMap<Table>, Name>

type JsqlColumnFactsHasKeysOtherThan<Table, Name extends string> =
	JsqlGetColumnFactsMap<Table> extends infer M
		? M extends JsqlColumnFactsMap
			? [Exclude<keyof M, Name>] extends [never]
				? false
				: true
			: false
		: false

type TableWithNewColumnFacts<Table extends { columns: unknown }, NextFacts extends JsqlColumnFactsMap> = {
	columns: Table["columns"]
} & (Table extends { constraints: infer M extends JsqlConstraintMap } ? { constraints: M } : unknown) & {
		column_facts: NextFacts
	}

export type JsqlAddColumnFacts<
	Table extends { columns: unknown },
	Name extends string,
	Entry extends JsqlColumnFactsEntry,
> =
	JsqlGetColumnFactsMap<Table> extends infer Existing extends JsqlColumnFactsMap
		? TableWithNewColumnFacts<Table, Existing & { [N in Name]: Entry }>
		: SqlParserError<"Internal column facts map error">

export type JsqlDropColumnFacts<
	Table extends { columns: unknown },
	Name extends string,
> = Name extends keyof JsqlGetColumnFactsMap<Table>
	? JsqlColumnFactsHasKeysOtherThan<Table, Name> extends true
		? {
				columns: Table["columns"]
			} & (Table extends { constraints: infer M extends JsqlConstraintMap } ? { constraints: M } : unknown) & {
					column_facts: JsqlColumnFactsAfterDrop<Table, Name>
				}
		: Omit<Table, "column_facts">
	: Table

export type JsqlRenameColumnFacts<Table extends { columns: unknown }, From extends string, To extends string> =
	JsqlGetColumnFactsMap<Table> extends infer M
		? M extends JsqlColumnFactsMap
			? [keyof M] extends [never]
				? Table
				: {
						columns: Table["columns"]
					} & (Table extends { constraints: infer Cons extends JsqlConstraintMap }
						? { constraints: Cons }
						: unknown) & {
							column_facts: {
								[Kn in keyof M as Kn extends From ? To : Kn]: M[Kn]
							}
						}
			: Table
		: Table
