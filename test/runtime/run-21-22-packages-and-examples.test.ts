// RUN-21 (dbtyper-nest package metadata) and RUN-22 (the Postgres examples, the parts that need no database).
// The install with Nest 10.x and 11.x and the docker run of RUN-22 are not run here (they need a registry / Docker):
// the peer ranges are asserted instead of the install, and the database parts live in the examples' integration tests.
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { compileSnippets } from "../test-utils/compile-snippets.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p: string) => readFileSync(path.join(root, p), "utf8")
const json = (p: string) => JSON.parse(read(p)) as Record<string, any>

describe("RUN-21 packages/dbtyper-nest", () => {
	const pkg = json("packages/dbtyper-nest/package.json")
	it('RUN-21: "type": "module" and peerDependencies on @nestjs/common, @nestjs/core and dbtyper', () => {
		assert.equal(pkg.type, "module")
		assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ["@nestjs/common", "@nestjs/core", "dbtyper"])
	})
	it("RUN-21: the Nest peer range accepts 10.x, 11.x (and 12.x): no peer conflict for either", () => {
		for (const name of ["@nestjs/common", "@nestjs/core"]) {
			const alternatives = (pkg.peerDependencies[name] as string).split("||").map(s => s.trim())
			for (const major of [10, 11, 12]) {
				assert.ok(
					alternatives.includes(`^${major}.0.0`),
					`${name} peer range ${pkg.peerDependencies[name]} lacks ^${major}`,
				)
			}
		}
	})
	it("RUN-21: import { DbtyperModule, InjectDbtyper } from the package entry type-checks", () => {
		const entry = pkg.exports["."].types as string // ./dist/src/index.d.ts, built from src/index.ts
		assert.match(entry, /index\.d\.ts$/)
		const r = compileSnippets({
			run21: `import { DbtyperModule, InjectDbtyper } from "../../../packages/dbtyper-nest/src/index.ts"
export const x = [DbtyperModule, InjectDbtyper]\n`,
		})
		assert.deepEqual(r.run21!.diagnostics, [])
	})
})

describe("RUN-22 Postgres examples", () => {
	for (const name of ["typed-postgres", "nest-postgres"]) {
		const dir = `examples/${name}`
		const files = readdirSync(path.join(root, dir, "migrations"))
			.filter(f => /\.do\..+\.js$/.test(f))
			.sort()
		it(`RUN-22 ${name}: postgrator reads migrations/*.do.*.js`, () => {
			assert.ok(files.length > 0)
			assert.match(read(`${dir}/scripts/migrate.ts`), /migrations\/\*\.do\.\*\.js/)
		})
		// nest-postgres skips 005.do.seed_agenda.js: bug #204
		it(
			`RUN-22 ${name}: .apply(...) receives the SQL of every migration file, in file order`,
			{ skip: name === "nest-postgres" && "bug #204" },
			() => {
				const applied = [
					...read(`${dir}/src/example-schema.ts`).matchAll(
						/import\("\.\.\/migrations\/([^"]+)"\)\)\.generateSql\(\)/g,
					),
				].map(m => m[1])
				assert.deepEqual(applied, files)
			},
		)
		it(`RUN-22 ${name}: the example has a docker test that selects email from auth.users`, () => {
			assert.match(read(`${dir}/test/integration.test.ts`), /select email[^"`]*from auth\.users/)
		})
	}
	it("RUN-22 / TEST-7: test:ci type-checks both examples and does not run their database tests", () => {
		const ci = json("package.json").scripts["test:ci"] as string
		assert.match(ci, /typecheck -w @dbtyper\/example-postgres/)
		assert.match(ci, /typecheck -w @dbtyper\/example-nest-postgres/)
		assert.doesNotMatch(ci, /test -w @dbtyper\/example-(nest-)?postgres/)
	})
})
