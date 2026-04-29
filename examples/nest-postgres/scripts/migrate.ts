/**
 * Exports TypeScript migrations to a temporary directory as `.sql` files, then applies them in order
 * using the `postgres` driver (simple migration runner — no extra CLI dependency).
 * Normal migrations first, then optional **patches** (`patch()` — see `docs/MIGRATIONS.md`).
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import postgres from "postgres"
import type { MigrationExport } from "typesql"

import { allMigrationFilenames, allPatchFilenames } from "../src/example-schema.ts"

async function exportSqlFiles(outDir: string) {
	await mkdir(outDir, { recursive: true })
	const migrationsDir = new URL("../migrations/", import.meta.url)
	let index = 0
	for (const name of allMigrationFilenames) {
		index += 1
		const mod = await import(new URL(name, migrationsDir).href)
		const row = mod.default as MigrationExport
		if (row.patch === true) {
			throw new Error(
				`${name}: listed in allMigrationFilenames but exports patch: true — use migration(), not patch(), or move it to allPatchFilenames (see docs/MIGRATIONS.md).`,
			)
		}
		const base = name.replace(/\.ts$/i, "")
		const target = join(outDir, `${String(index).padStart(3, "0")}_${base}.sql`)
		await writeFile(target, `${row.source.trim()}\n`, "utf8")
		console.error(`wrote ${target}`)
	}
	for (const name of allPatchFilenames) {
		index += 1
		const mod = await import(new URL(name, migrationsDir).href)
		const row = mod.default as MigrationExport
		if (row.patch !== true) {
			throw new Error(
				`${name}: listed in allPatchFilenames but does not use patch(import.meta.url).add(...) — fix or remove from allPatchFilenames.`,
			)
		}
		const base = name.replace(/\.ts$/i, "")
		const target = join(outDir, `${String(index).padStart(3, "0")}_patch_${base}.sql`)
		await writeFile(target, `${row.source.trim()}\n`, "utf8")
		console.error(`wrote patch ${target}`)
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

const outDir = process.env.TYPESQL_MIGRATIONS_OUT ?? (await mkdtemp(join(tmpdir(), "typesql-nest-migrations-")))

await exportSqlFiles(outDir)
console.error(`migrations SQL export directory: ${outDir}`)

const sql = postgres(databaseUrl, { max: 1 })
try {
	await runSqlFiles(sql, outDir)
	console.log("migrations applied OK")
} finally {
	await sql.end({ timeout: 5 })
}
