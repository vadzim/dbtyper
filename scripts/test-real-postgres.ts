// Runs the tests that need a real PostgreSQL (TEST-6/7): test/runtime/pgt-35-checks-real-postgres.test.ts and the
// integration tests of the two Postgres examples. Needs DBTYPER_PG_URL (a PostgreSQL server, e.g. the CI service
// container); every suite gets a database of its own on that server so that they cannot see each other's tables.
// Run: DBTYPER_PG_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:postgres
import { spawnSync } from "node:child_process"
import postgres from "postgres"

const serverUrl = process.env.DBTYPER_PG_URL
if (serverUrl === undefined || serverUrl === "") {
	console.error("Set DBTYPER_PG_URL, e.g. postgres://postgres:postgres@127.0.0.1:5432/postgres")
	process.exit(1)
}

const suites = [
	{ database: "dbtyper_pgt35", args: ["--test", "test/runtime/pgt-35-checks-real-postgres.test.ts"] },
	{ database: "dbtyper_run23", args: ["--test", "test/runtime/run-23-driver-value-kinds.test.ts"] },
	{ database: "dbtyper_example_postgres", args: ["--test", "examples/typed-postgres/test/integration.test.ts"] },
	{ database: "dbtyper_example_nest", args: ["--test", "examples/nest-postgres/test/integration.test.ts"] },
]

const admin = postgres(serverUrl, { max: 1, onnotice: () => {} })
let failed = false
try {
	for (const { database, args } of suites) {
		await admin.unsafe(`drop database if exists ${database}`)
		await admin.unsafe(`create database ${database}`)
		const url = new URL(serverUrl)
		url.pathname = `/${database}`
		const { status } = spawnSync(process.execPath, ["--test-timeout=240000", ...args], {
			stdio: "inherit",
			timeout: 300_000, // a hung suite (an open handle) fails the run instead of waiting for ever
			killSignal: "SIGKILL",
			env: { ...process.env, DBTYPER_PG_URL: url.toString() },
		})
		if (status !== 0) failed = true
	}
} finally {
	await admin.end({ timeout: 5 })
}
process.exit(failed ? 1 : 0)
