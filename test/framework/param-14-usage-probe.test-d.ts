// PARAM-14: a parameter the SQL reads is told from one it does not read by marking it; reading a marked parameter is
// the internal error 2406 (never shown to users).
import type { ApplyStatements } from "../../src/parser/parse-sql-statement.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import type { JsqlDatabaseShape } from "../../src/core/jsql-shapes.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Marked = { x: { type: "param-read-probe"; arg: null; nullable: false } }
type Err = ApplyStatements<JsqlDatabaseShape, "select :x as x;", Marked, "named-params">[1]
type Unused = ApplyStatements<JsqlDatabaseShape, "select 1 as a;", Marked, "named-params">[1]

expectType<Err>(toBe<DbtyperError<2406, "internal: a parameter was read">>())
expectType<Unused>(toBe<null>())
