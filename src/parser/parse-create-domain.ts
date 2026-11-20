/**
 * `CREATE DOMAIN [schema.]name [AS] base [COLLATE …] [DEFAULT …] [NOT NULL | NULL] [CHECK (…)]…` (PGT-22): the domain
 * is typed as its base type, NOT NULL if the domain says so (a columns of it, see `ResolveUserType`). DEFAULT and
 * CHECK are skipped: they do not change a type.
 */
import type { JsqlDatabaseShape, JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot, TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"
import type { JsqlDbGetSchema, JsqlDbGetType, JsqlDbReplaceType, JsqlDomainType } from "../core/jsql-utils.ts"
import type { SkipBracketedUntil, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseQualifiedName } from "./parse-qualified-name.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"

/** At the token after `DOMAIN`. */
export type ParseCreateDomain<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseQualifiedName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Name extends string,
	]
		? E extends null
			? JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
				? JsqlDbGetType<Db, Sch, Name> extends null
					? PeekToken<R> extends TokenKey<"as">
						? DomainBase<SkipToken<R>, Db, Sch, Name>
						: DomainBase<R, Db, Sch, Name>
					: SkipFailedStatement<R, Db, FormatError<Errors["TYPE_ALREADY_EXISTS_USE_IF_NOT_EXISTS"], []>>
				: SkipFailedStatement<R, Db, FormatError<Errors["UNKNOWN_SCHEMA"], [Sch, "CREATE DOMAIN"]>>
			: [R, Db, E extends DbtyperErrorShape ? E : FormatError<Errors["INVALID_CREATE_TYPE_NAME_PARSE"], []>]
		: never

type DomainBase<R extends ParserMonad, Db extends JsqlDatabaseShape, Sch extends string, Name extends string> =
	ParseSqlType<R, Db, false, Sch> extends [infer After extends ParserMonad, infer Base]
		? Base extends SqlTypeShape
			? DomainRest<After, Db, Sch, Name, NonNull<Base>, Base["nullable"] extends false ? true : false>
			: [After, Db, Base extends DbtyperErrorShape ? Base : FormatError<Errors["EXPECTED_TYPE_NAME"], [""]>]
		: never

/** The constraints up to `;`: only `NOT NULL` matters. */
type DomainRest<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Name extends string,
	Base extends SqlTypeShape,
	NotNull extends boolean,
> =
	SkipBracketedUntil<Tokens, TokenKey<"not" | ";"> | TokenEot> extends [infer Rest extends ParserMonad, infer Result]
		? Result extends DbtyperErrorShape
			? [Rest, Db, Result]
			: PeekToken<Rest> extends TokenKey<"not">
				? DomainRest<SkipToken<Rest>, Db, Sch, Name, Base, true>
				: JsqlDbReplaceType<Db, Sch, Name, JsqlDomainType<Base, NotNull>> extends infer NewDb extends
							JsqlDatabaseShape
					? [SkipToken<Rest>, NewDb, null]
					: never
		: never
