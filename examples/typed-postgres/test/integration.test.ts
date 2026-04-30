import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import postgres from "postgres"

import { createExampleApp } from "../src/sample-app.ts"

const exampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54333/dbtyper_example"

/** Run when CI is set or explicitly opted in (requires Docker). */
const runIntegration = process.env.CI === "true" || process.env.RUN_TYPED_PG_INTEGRATION === "1"

function compose(args: string, stdio: "inherit" | "pipe") {
	execSync(`docker compose ${args}`, { cwd: exampleRoot, stdio })
}

/** `pg_isready` is not enough; wait until the driver can run `SELECT 1`. */
async function waitForPostgresAcceptingConnections(timeoutMs = 90_000) {
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		const sql = postgres(databaseUrl, { max: 1 })
		try {
			await sql`select 1 as ok`
			await sql.end({ timeout: 5 })
			return
		} catch {
			await sql.end({ timeout: 2 }).catch(() => {})
			await new Promise<void>(resolve => {
				setTimeout(resolve, 400)
			})
		}
	}
	throw new Error("Postgres did not accept connections in time")
}

describe(
	"typed-postgres docker integration (reset → up → migrate → app → typed query)",
	{ skip: !runIntegration },
	() => {
		it("migrations, app.ts prints seeded users, compile-time query() returns same rows", async () => {
			compose("down -v --remove-orphans", "inherit")
			compose("up -d", "inherit")
			await waitForPostgresAcceptingConnections()

			execSync("npx tsx scripts/migrate.ts", {
				cwd: exampleRoot,
				stdio: "inherit",
				env: { ...process.env, DATABASE_URL: databaseUrl },
			})

			const appStdout = execSync("npx tsx src/app.ts", {
				cwd: exampleRoot,
				encoding: "utf8",
				env: { ...process.env, DATABASE_URL: databaseUrl },
			})
			assert.match(appStdout, /alice@example\.com/)
			assert.match(appStdout, /bob@example\.com/)

			const { app, sql } = await createExampleApp(databaseUrl)
			try {
				const rows = await app.query("select email, display_name from auth.users order by email;")
				assert.ok(Array.isArray(rows))
				assert.ok(rows.length >= 2)
				const emails = (rows as { email: string }[]).map(r => r.email).sort()
				assert.deepEqual(emails.slice(0, 2), ["alice@example.com", "bob@example.com"])
			} finally {
				await sql.end({ timeout: 5 })
			}
		})
	},
)
