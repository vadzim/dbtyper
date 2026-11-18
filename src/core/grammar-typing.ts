/**
 * Which typer types a statement text (track B, #55; DECISIONS.md "Grammar-driven typing (#55)").
 *
 * - SQLite chains: the text is parsed once by the SQLite grammar with semantic actions (`Parse`, src/gram/driver.ts,
 *   actions in src/gram/sqlite/actions.ts) and the AST is typed by src/gram/sqlite/typer.ts. What that typer does not
 *   cover yet (`Unsupported`, including every statement it would reject) is typed by the inherited typer
 *   (`ApplyStatements`, src/parser) on the same text. A text the grammar rejects gets the dialect gate's verdict
 *   (`SqliteGateError`) over the inherited typer's error.
 * - PostgreSQL chains: the inherited typer, unchanged (the PostgreSQL grammar is only the error-path gate).
 *
 * The result has the shape of `ApplyStatements`: `[db, error | null, { returning: columns | null }]`.
 */
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { Parse } from "../gram/driver.ts"
import type { SqliteActions } from "../gram/sqlite/actions.ts"
import type { Tables as SqliteTables } from "../gram/sqlite/tables.d.ts"
import type { SqliteTokens } from "../gram/sqlite/tokens.ts"
import type { SqliteTypeProgram, Unsupported } from "../gram/sqlite/typer.ts"
import type { ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqliteGateError, SqliteLexGap } from "./dialect-gate.ts"
import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { LexerFeatures } from "../lexer/sql-lexer.ts"
import type { LastOf } from "./type-utils.ts"

type TypingConfig = { dialect: string; syntax: LexerFeatures; scalarTypes: Record<string, unknown> }

export type TypedStatements<
	Config extends TypingConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | null,
> = [Config["dialect"]] extends ["sqlite"]
	? SqliteStatements<Config, Db, Stmt, Params>
	: ApplyStatements<Db, Stmt, Params, Config["syntax"]>

type SqliteStatements<
	Config extends TypingConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | null,
> = string extends Stmt
	? Inherited<Config, Db, Stmt, Params>
	: Stmt extends SqliteLexGap
		? Inherited<Config, Db, Stmt, Params> // the SQLite token stream of such a text is not reliable (dialect-gate.ts)
		: SqliteTokens<Stmt> extends [infer Terminals extends string[], infer Texts extends string[]]
			? Parse<SqliteTables, Terminals, Texts, SqliteActions> extends infer R
				? R extends { ok: true; value: infer Ast }
					? SqliteTypeProgram<Db, Ast> extends infer P
						? P extends Unsupported
							? Inherited<Config, Db, Stmt, Params>
							: P extends [infer NewDb, null, infer Result]
								? [NewDb, Unmapped<Result, Config["scalarTypes"]>, Result]
								: never
						: never
					: Inherited<Config, Db, Stmt, Params> extends [infer NewDb, infer Error, infer Result]
						? [NewDb, SqliteGateError<Stmt, R, Error & (DbtyperErrorShape | null)>, Result]
						: never
				: never
			: never

/** The inherited typer on a SQLite chain (its default schema exists from the start, #100). */
type Inherited<
	Config extends TypingConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | null,
> = ApplyStatements<Db, Stmt, Params, Config["syntax"]>

/**
 * CORE-14: an output column whose SQL type has no TypeScript type in the driver's map is error 3506 naming the type.
 * `null` (CORE-5) and `any` (a SQLite column without a declared type, SQLT-10) map without an entry of their own.
 */
type Unmapped<Result, ScalarMap> = Result extends { returning: infer Cols extends Record<string, { type: string }> }
	? {
			[K in keyof Cols]: Cols[K]["type"] extends "null" | "any" | keyof ScalarMap ? never : Cols[K]["type"]
		}[keyof Cols] extends infer Missing extends string
		? [Missing] extends [never]
			? null
			: FormatError<Errors["NO_TYPESCRIPT_TYPE_FOR_SQL_TYPE"], [LastOf<Missing> & string]>
		: null
	: null
