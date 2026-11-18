// Regenerates src/gram/gram.ts from src/gram/gram.y (bison --xml -> xml2ts.ts).
// Only bison is required (flex is not used by the TS pipeline).
import { spawnSync } from "node:child_process"
import { rmSync } from "node:fs"

const dir = new URL("../src/gram/", import.meta.url).pathname

const probe = spawnSync("bison", ["--version"], { encoding: "utf8" })
if (probe.error || probe.status !== 0) {
	console.error(
		"gram:generate needs GNU bison (>= 3.0) in PATH. Install it:\n" +
			"  Debian/Ubuntu: apt install bison\n  Arch/Manjaro: pacman -S bison\n  macOS: brew install bison (and put it before /usr/bin in PATH)",
	)
	process.exit(1)
}

function run(cmd, args) {
	const r = spawnSync(cmd, args, { cwd: dir, stdio: "inherit" })
	if (r.status !== 0) process.exit(r.status ?? 1)
}

run("bison", ["--xml", "-Wno-deprecated", "-Wno-other", "gram.y"])
run("node", ["xml2ts.ts"])
for (const f of ["gram.xml", "gram.tab.c"]) rmSync(dir + f, { force: true })
