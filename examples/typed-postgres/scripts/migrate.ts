/**
 * Exports TypeScript migrations to a temporary directory as `.sql` files, then applies them in order
 * using the `postgres` driver (simple migration runner — no extra CLI dependency).
 * Normal migrations first.
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import postgres from "postgres"
import type { PostgresTypeMap } from "typesql/postgres"

import { compileExampleDb } from "../src/example-schema.ts"

function migrationBasename(path: string, index: number): string {
	if (path === "") {
		return `inline_${String(index).padStart(3, "0")}`
	}
	try {
		const u = new URL(path)
		const file = u.pathname.split("/").at(-1) ?? `migration_${String(index).padStart(3, "0")}.ts`
		return file.replace(/\.ts$/i, "")
	} catch {
		const file = path.split("/").at(-1) ?? `migration_${String(index).padStart(3, "0")}.ts`
		return file.replace(/\.ts$/i, "")
	}
}

async function exportSqlFiles(outDir: string) {
	await mkdir(outDir, { recursive: true })
	const compiled = await compileExampleDb({
		query: async () => [],
		async *stream() {},
		scalarTypes: {} as PostgresTypeMap,
	})
	let index = 0
	for (const row of compiled.migrations) {
		index += 1
		const base = migrationBasename(row.path, index)
		const target = join(outDir, `${String(index).padStart(3, "0")}_${base}.sql`)
		await writeFile(target, `${row.source.trim()}\n`, "utf8")
		console.error(`wrote ${target}`)
	}
}

async function runSqlFiles(sql: ReturnType<typeof postgres>, dir: string) {
	const { readdir } = await import("node:fs/promises")
	const names = (await readdir(dir)).filter(n => n.endsWith(".sql")).sort()
	for (const name of names) {
		const path = join(dir, name)
		const body = await readFile(path, "utf8")
		console.error(`applying ${path}`)
		await sql.unsafe(body)
	}
}

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === "") {
	console.error("Set DATABASE_URL (see .env.example).")
	process.exit(1)
}

const outDir = process.env.TYPESQL_MIGRATIONS_OUT ?? (await mkdtemp(join(tmpdir(), "typesql-pg-migrations-")))

await exportSqlFiles(outDir)
console.error(`migrations SQL export directory: ${outDir}`)

const sql = postgres(databaseUrl, { max: 1 })
try {
	await runSqlFiles(sql, outDir)
	console.log("migrations applied OK")
} finally {
	await sql.end({ timeout: 5 })
}
