import type { SqlDatabaseLike } from "./sql-database.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlIgnorableStatement } from "../parser/sql-ignorable.js"
import type { SqlCreateIndex } from "../parser/sql-create-index.js"
import type { SqlInsertValues } from "../parser/sql-insert-values.js"
import type { SqlCreateSchema } from "../parser/sql-create-schema.js"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlDropSchema } from "../parser/sql-drop-schema.js"
import type { SqlDropTable } from "../parser/sql-drop-table.js"
import type { SqlAlterTable } from "../parser/sql-alter-table.js"
import type { ApplyAlterTable } from "./apply-alter-table.js"
import type { ApplyCreateIndex } from "./apply-create-index.js"
import type { ApplyCreateSchema } from "./apply-create-schema.js"
import type { ApplyCreateTable } from "./apply-create-table.js"
import type { ApplyDropSchema } from "./apply-drop-schema.js"
import type { ApplyDropTable } from "./apply-drop-table.js"
import type { ApplyInsertValues } from "./apply-insert-values.js"

export type SqlStatementLike =
	| SqlIgnorableStatement
	| SqlCreateIndex
	| SqlInsertValues
	| SqlAlterTable
	| SqlCreateSchema
	| SqlCreateTable
	| SqlDropSchema
	| SqlDropTable
	| SqlParseError<string>

export type SqlApplyStatement<
	Db extends SqlDatabaseLike | SqlParseError<string>,
	Statement extends SqlStatementLike,
> = Db extends SqlDatabaseLike
	? FlattenDBType<
			Statement extends SqlIgnorableStatement
				? Db
				: Statement extends SqlCreateIndex
					? ApplyCreateIndex<Db, Statement>
					: Statement extends SqlInsertValues
						? ApplyInsertValues<Db, Statement>
						: Statement extends SqlCreateSchema
							? ApplyCreateSchema<Db, Statement>
							: Statement extends SqlCreateTable
								? ApplyCreateTable<Db, Statement>
								: Statement extends SqlAlterTable
									? ApplyAlterTable<Db, Statement>
									: Statement extends SqlDropTable
										? ApplyDropTable<Db, Statement>
										: Statement extends SqlDropSchema
											? ApplyDropSchema<Db, Statement>
											: Statement extends SqlParseError<string>
												? Statement
												: SqlParseError<"Unsupported SqlApply statement">
		>
	: Db

export type SqlApplyStatements<
	Db extends SqlDatabaseLike | SqlParseError<string>,
	Statements extends readonly SqlStatementLike[] | SqlParseError<string>,
> =
	Statements extends SqlParseError<string>
		? Statements
		: Statements extends readonly [
					infer First extends SqlStatementLike,
					...infer Rest extends readonly SqlStatementLike[],
			  ]
			? SqlApplyStatements<SqlApplyStatement<Db, First>, Rest>
			: Db

/** Kept as identity so chained applies preserve the same nominal DB shape for type tests (`Matches`). */
type FlattenDBType<DB extends SqlDatabaseLike | SqlParseError<string>> = DB
