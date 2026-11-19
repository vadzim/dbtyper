// node probe/gen.mjs -> writes probe files: {where,insert}-{pg,sqlite}-{named,pos}-N.ts into probe/
import fs from "node:fs"
import path from "node:path"
const dir = path.dirname(new URL(import.meta.url).pathname)
const Ns = [0, 10, 30, 100, 150]
for (const N of Ns)
	for (const kind of ["where", "insert", "none"])
		for (const d of ["pg", "sqlite"])
			for (const style of ["named", "pos"]) {
				const cols = Array.from({ length: N }, (_, i) => `, c${i} integer not null`).join("")
				const p = (i) => (style === "named" ? `:p${i}` : d === "pg" ? `$${i + 1}` : `?${i + 1}`)
				let sql
				if (N === 0) sql = kind === "where" ? "select id from t;" : "insert into t (id) values (1);"
				else if (kind === "where")
					sql = "select id from t where " + Array.from({ length: N }, (_, i) => `c${i} = ${p(i)}`).join(" and ") + ";"
				else
					sql = `insert into t (id, ${Array.from({ length: N }, (_, i) => `c${i}`).join(", ")}) values (1, ${Array.from({ length: N }, (_, i) => p(i)).join(", ")});`
				const vals =
					N === 0
						? ""
						: style === "named"
							? ", {" + Array.from({ length: N }, (_, i) => `p${i}: ${i}`).join(", ") + "}"
							: ", [" + Array.from({ length: N }, (_, i) => `${i}`).join(", ") + "]"
				const drv = d === "pg" ? "mockDriver" : "sqliteMockDriver"
				const src = `import { sqlMigrations } from "../src/core/sql-database.ts"
import { ${drv} } from "../test/test-utils/test-databases.ts"
const _db = sqlMigrations({ driver: ${drv} }).apply(\`create table t (id integer not null${cols});\`).database()
${kind === "none" ? "export const r = _db" : `export const r = _db.query(\`${sql}\`${vals})`}
`
				fs.writeFileSync(path.join(dir, `${kind}-${d}-${style}-${N}.ts`), src)
			}
