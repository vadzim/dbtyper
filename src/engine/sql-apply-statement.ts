import type { SqlDatabaseLike } from "./sql-database.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlCreateSchemaLike } from "../parser/sql-create-schema.js"
import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { SqlDropSchemaLike } from "../parser/sql-drop-schema.js"
import type { SqlDropTableLike } from "../parser/sql-drop-table.js"
import type { SqlAlterTableLike } from "../parser/sql-alter-table.js"
import type { SqlApplyAlterTable } from "./sql-apply-alter-table.js"
import type { SqlApplyCreateSchema } from "./sql-apply-create-schema.js"
import type { SqlApplyCreateTable } from "./sql-apply-create-table.js"
import type { SqlApplyDropSchema } from "./sql-apply-drop-schema.js"
import type { SqlApplyDropTable } from "./sql-apply-drop-table.js"

export type SqlStatementLike =
	| SqlAlterTableLike
	| SqlCreateSchemaLike
	| SqlCreateTableLike
	| SqlDropSchemaLike
	| SqlDropTableLike
	| SqlParseError<string>

export type SqlApplyStatement<
	Db extends SqlDatabaseLike | SqlParseError<string>,
	Statement extends SqlStatementLike,
> = Db extends SqlDatabaseLike
	? FlattenDBType<
			Statement extends SqlCreateSchemaLike
				? SqlApplyCreateSchema<Db, Statement>
				: Statement extends SqlCreateTableLike
					? SqlApplyCreateTable<Db, Statement>
					: Statement extends SqlAlterTableLike
						? SqlApplyAlterTable<Db, Statement>
						: Statement extends SqlDropTableLike
							? SqlApplyDropTable<Db, Statement>
							: Statement extends SqlDropSchemaLike
								? SqlApplyDropSchema<Db, Statement>
								: Statement extends SqlParseError<string>
									? Statement
									: SqlParseError<"Unsupported SqlApply statement">
		>
	: Db

type FlattenDBType<DB extends SqlDatabaseLike | SqlParseError<string>> = DB extends SqlDatabaseLike
	? {
			readonly kind: "database"
			readonly defaultSchema: DB["defaultSchema"]
			readonly schemas: DB["schemas"] extends infer S
				? S // {
				: // 			[KS in keyof S]: S[KS]
					// extends infer T
					// 	? { [KT in keyof T]: T[KT] extends infer U ? { [KU in keyof U]: U[KU] } : never }
					// 	: never
					// 	}
					never
		}
	: DB
