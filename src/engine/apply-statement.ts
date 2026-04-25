import type { SqlDatabaseLike } from "./sql-database.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SkippedStatement } from "../parser/skip-statement.ts"
import type { CreateIndexStatement } from "../parser/parse-create-index.ts"
import type { InsertValuesStatement } from "../parser/parse-insert-values.ts"
import type { CreateSchemaStatement } from "../parser/parse-create-schema.ts"
import type { CreateTableStatement } from "../parser/parse-create-table.ts"
import type { DropSchemaStatement } from "../parser/parse-drop-schema.ts"
import type { DropTableStatement } from "../parser/parse-drop-table.ts"
import type { AlterTableStatement } from "../parser/parse-alter-table.ts"
import type { SelectStatement } from "../parser/parse-select.ts"
import type { ApplyAlterTable } from "./apply-alter-table.ts"
import type { ApplyCreateIndex } from "./apply-create-index.ts"
import type { ApplyCreateSchema } from "./apply-create-schema.ts"
import type { ApplyCreateTable } from "./apply-create-table.ts"
import type { ApplyDropSchema } from "./apply-drop-schema.ts"
import type { ApplyDropTable } from "./apply-drop-table.ts"
import type { ApplyInsertValues } from "./apply-insert-values.ts"
import type { ApplySelect } from "./apply-select.ts"

export type SqlStatement =
	| SkippedStatement
	| CreateIndexStatement
	| InsertValuesStatement
	| AlterTableStatement
	| CreateSchemaStatement
	| CreateTableStatement
	| DropSchemaStatement
	| DropTableStatement
	| SelectStatement
	| SqlParserError<string>

export type SqlApplyStatement<
	Db extends SqlDatabaseLike | SqlParserError<string>,
	Statement extends SqlStatement,
> = Db extends SqlDatabaseLike
	? Statement extends SkippedStatement
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
									: Statement extends SelectStatement
										? ApplySelect<Db, Statement>
										: Statement extends SqlParserError<string>
											? Statement
											: SqlParserError<"Unsupported SqlApply statement">
	: Db

export type SqlApplyStatements<
	Db extends SqlDatabaseLike | SqlParserError<string>,
	Statements extends SqlStatement[] | SqlParserError<string>,
> =
	Statements extends SqlParserError<string>
		? Statements
		: Statements extends [infer First extends SqlStatement, ...infer Rest extends SqlStatement[]]
			? SqlApplyStatements<SqlApplyStatement<Db, First>, Rest>
			: Db
