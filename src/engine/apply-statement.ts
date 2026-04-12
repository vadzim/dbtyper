import type { SqlDatabaseLike } from "./sql-database.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { SkippedStatement } from "../parser/skip-statement.js"
import type { CreateIndexStatement } from "../parser/parse-create-index.js"
import type { InsertValuesStatement } from "../parser/parse-insert-values.js"
import type { CreateSchemaStatement } from "../parser/parse-create-schema.js"
import type { CreateTableStatement } from "../parser/parse-create-table.js"
import type { DropSchemaStatement } from "../parser/parse-drop-schema.js"
import type { DropTableStatement } from "../parser/parse-drop-table.js"
import type { AlterTableStatement } from "../parser/parse-alter-table.js"
import type { ApplyAlterTable } from "./apply-alter-table.js"
import type { ApplyCreateIndex } from "./apply-create-index.js"
import type { ApplyCreateSchema } from "./apply-create-schema.js"
import type { ApplyCreateTable } from "./apply-create-table.js"
import type { ApplyDropSchema } from "./apply-drop-schema.js"
import type { ApplyDropTable } from "./apply-drop-table.js"
import type { ApplyInsertValues } from "./apply-insert-values.js"

export type SqlStatement =
	| SkippedStatement
	| CreateIndexStatement
	| InsertValuesStatement
	| AlterTableStatement
	| CreateSchemaStatement
	| CreateTableStatement
	| DropSchemaStatement
	| DropTableStatement
	| SqlParserError<string>

export type SqlApplyStatement<
	Db extends SqlDatabaseLike | SqlParserError<string>,
	Statement extends SqlStatement,
> = Db extends SqlDatabaseLike
	? FlattenDBType<
			Statement extends SkippedStatement
				? Db
				: Statement extends CreateIndexStatement
					? ApplyCreateIndex<Db, Statement>
					: Statement extends InsertValuesStatement
						? ApplyInsertValues<Db, Statement>
						: Statement extends CreateSchemaStatement
							? ApplyCreateSchema<Db, Statement>
							: Statement extends CreateTableStatement
								? ApplyCreateTable<Db, Statement>
								: Statement extends AlterTableStatement
									? ApplyAlterTable<Db, Statement>
									: Statement extends DropTableStatement
										? ApplyDropTable<Db, Statement>
										: Statement extends DropSchemaStatement
											? ApplyDropSchema<Db, Statement>
											: Statement extends SqlParserError<string>
												? Statement
												: SqlParserError<"Unsupported SqlApply statement">
		>
	: Db

export type SqlApplyStatements<
	Db extends SqlDatabaseLike | SqlParserError<string>,
	Statements extends readonly SqlStatement[] | SqlParserError<string>,
> =
	Statements extends SqlParserError<string>
		? Statements
		: Statements extends readonly [infer First extends SqlStatement, ...infer Rest extends readonly SqlStatement[]]
			? SqlApplyStatements<SqlApplyStatement<Db, First>, Rest>
			: Db

/** Kept as identity so chained applies preserve the same nominal DB shape for type tests (`Matches`). */
type FlattenDBType<DB extends SqlDatabaseLike | SqlParserError<string>> = DB
