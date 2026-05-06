import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "./jsql-shapes.ts"
import type { JsqlCreateTable, JsqlCreateView, JsqlDbReplaceSet } from "./jsql-utils.ts"

export type MergeViewIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> = JsqlDbReplaceSet<Db, Schema, Name, JsqlCreateView<Sel["columns"]>>

export type MergeTableIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Cols extends Record<string, string>,
	Facts extends Record<string, unknown>,
> = JsqlDbReplaceSet<Db, Schema, Table, JsqlCreateTable<Cols, Facts>>
