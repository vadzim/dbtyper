import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
	peerDependencies: Record<string, string>
	devDependencies: Record<string, string>
}
const installed = JSON.parse(
	readFileSync(new URL("../../node_modules/postgres/package.json", import.meta.url), "utf8"),
) as {
	name: string
	version: string
}

describe("supported PostgreSQL driver", () => {
	it("PGT-1: the `postgres` (porsager) package, version floor ^3.4", () => {
		assert.equal(pkg.peerDependencies.postgres, "^3.4.0")
		assert.equal(installed.name, "postgres")
		const [major, minor] = installed.version.split(".").map(Number)
		assert.equal(major, 3)
		assert.ok((minor ?? 0) >= 4, `installed postgres ${installed.version} is below 3.4`)
		assert.match(pkg.devDependencies.postgres ?? "", /^\^3\.4\./)
	})
})
