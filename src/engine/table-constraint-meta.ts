import type { ForeignRefMeta } from "../parser/sql-constraints-fk.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"

export type JsqlTableConstraintsKey = "$jsql:constraints"

export type JsqlConstraintEntry =
	| { kind: "primary_key"; columns: string[] }
	| { kind: "unique"; columns: string[] }
	| { kind: "foreign_key"; refs: ForeignRefMeta }

type JsqlConstraintMap = { [K: string]: JsqlConstraintEntry }

/** Presence of the `"$jsql:constraints"` key is required; optional lookup would mistake plain rows for an empty map. */
export type JsqlGetConstraintMap<Row> = JsqlTableConstraintsKey extends keyof Row
	? Row[JsqlTableConstraintsKey] extends JsqlConstraintMap
		? Row[JsqlTableConstraintsKey]
		: {}
	: {}

type JsqlHasConstraint<Row, Name extends string> = Name extends keyof JsqlGetConstraintMap<Row>
	? JsqlGetConstraintMap<Row>[Name] extends JsqlConstraintEntry
		? true
		: false
	: false

type JsqlRowWithoutMap<Row> = Omit<Extract<Row, Record<string, unknown>>, JsqlTableConstraintsKey>

export type JsqlAddConstraint<Row, Name extends string, Entry extends JsqlConstraintEntry> =
	JsqlHasConstraint<Row, Name> extends true
		? SqlParserError<`Duplicate constraint name: ${Name & string}`>
		: JsqlRowWithoutMap<Row> & {
				[k in JsqlTableConstraintsKey]: JsqlGetConstraintMap<Row> & { [K in Name]: Entry }
			}

type JsqlMapAfterDrop<Row, Name extends string> = Omit<JsqlGetConstraintMap<Row>, Name>

/** `Exclude<keyof M, k>` is `never` when `k` is the only key (or the map is empty, which cannot happen with Has). */
type JsqlMapHasKeysOtherThan<Row, Name extends string> = JsqlGetConstraintMap<Row> extends infer M
	? M extends JsqlConstraintMap
		? [Exclude<keyof M, Name>] extends [never]
			? false
			: true
		: false
	: false

export type JsqlDropConstraint<Row, Name extends string, IfExists extends boolean> = JsqlHasConstraint<
	Row,
	Name
> extends true
	? JsqlMapHasKeysOtherThan<Row, Name> extends true
		? JsqlRowWithoutMap<Row> & { [K in JsqlTableConstraintsKey]: JsqlMapAfterDrop<Row, Name> }
		: JsqlRowWithoutMap<Row>
	: IfExists extends true
		? Row
		: SqlParserError<`Unknown constraint "${Name & string}" in table`>
