// node probe/gen-check.mjs N -> probe/check-N.ts: correctness of wide parameter lists (types and wrong values)
import fs from "node:fs"
import path from "node:path"
const dir = path.dirname(new URL(import.meta.url).pathname)
const N = Number(process.argv[2] ?? 100)
const range = (f) => Array.from({ length: N }, (_, i) => f(i))
const cols = range((i) => `, c${i} integer not null`).join("")
const named = (bad) => "{" + range((i) => `p${i}: ${bad && i === N - 1 ? '"x"' : i}`).join(", ") + "}"
const pos = (bad) => "[" + range((i) => (bad && i === N - 1 ? '"x"' : `${i}`)).join(", ") + "]"
const where = "select id from t where " + range((i) => `c${i} = :p${i}`).join(" and ") + ";"
const ins = `insert into t (id, ${range((i) => `c${i}`).join(", ")}) values (1, ${range((i) => `$${i + 1}`).join(", ")});`
const upd = "update t set " + range((i) => `c${i} = :p${i}`).join(", ") + " where id = 1;"
const inl = "select id from t where c0 in (" + range((i) => `$${i + 1}`).join(", ") + ");"
const mix = "select id from t where c0 = :p0 and :p0 = :p1;"
const src = `import { sqlMigrations } from "../src/core/sql-database.ts"
import { mockDriver, sqliteMockDriver } from "../test/test-utils/test-databases.ts"
import { expectType, toBe } from "../test/test-utils/type-test-utils.ts"
const pg = sqlMigrations({ driver: mockDriver }).apply(\`create table t (id integer not null${cols});\`).database()
const sl = sqlMigrations({ driver: sqliteMockDriver }).apply(\`create table t (id integer not null${cols});\`).database()
const w = await sl.query(\`${where}\`, ${named(false)})
expectType<typeof w>(toBe<Array<{ id: number }>>())
// @ts-expect-error
await sl.query(\`${where}\`, ${named(true)})
await pg.query(\`${ins}\`, ${pos(false)})
// @ts-expect-error
await pg.query(\`${ins}\`, ${pos(true)})
await pg.query(\`${upd}\`, ${named(false)})
// @ts-expect-error
await pg.query(\`${upd}\`, ${named(true)})
await pg.query(\`${inl}\`, ${pos(false)})
// @ts-expect-error
await pg.query(\`${inl}\`, ${pos(true)})
// @ts-expect-error CORE-7 on main-track too: only parameters meet in :p0 = :p1
await pg.query(\`${mix}\`, { p0: 1, p1: 2 })
// @ts-expect-error
await pg.query(\`${mix}\`, { p0: 1, p1: "x" })
`
fs.writeFileSync(path.join(dir, `check-${N}.ts`), src)
fs.writeFileSync(
	path.join(dir, `tsconfig.check-${N}.json`),
	JSON.stringify({ extends: "../tsconfig.json", include: [], files: [`check-${N}.ts`] }),
)
