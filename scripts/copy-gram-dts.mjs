// tsc does not emit hand-written or generated .d.ts files; the grammar gate's declarations import them (#97).
import { cpSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

function copy(dir) {
	for (const name of readdirSync(join("src", dir))) {
		const rel = join(dir, name)
		if (statSync(join("src", rel)).isDirectory()) copy(rel)
		else if (name.endsWith(".d.ts")) cpSync(join("src", rel), join("dist", "src", rel))
	}
}
copy("gram")
