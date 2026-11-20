// Checks what `npm pack` would ship (run `npm run build` first): no source maps (they point at src/, which is not
// shipped), no screenshots, and every file the `exports` map names is in the tarball.
// Run: npm run check:packaging
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const [pack] = JSON.parse(
	execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}),
) as [{ files: { path: string }[] }]
const shipped = new Set(pack.files.map(f => f.path))

const problems: string[] = []
for (const path of shipped) {
	if (path.endsWith(".map")) problems.push(`source map shipped: ${path}`)
	if (/\.(png|jpe?g|gif)$/i.test(path)) problems.push(`image shipped: ${path}`)
}

const manifest = JSON.parse(readFileSync("package.json", "utf-8")) as {
	exports: Record<string, Record<string, string>>
}
for (const [subpath, conditions] of Object.entries(manifest.exports)) {
	for (const [condition, target] of Object.entries(conditions)) {
		if (!shipped.has(target.replace(/^\.\//, "")))
			problems.push(`exports["${subpath}"].${condition} = ${target} is not in the tarball`)
	}
}

if (problems.length > 0) {
	console.error(problems.join("\n"))
	process.exit(1)
}
console.log(`packaging ok: ${shipped.size} files`)
