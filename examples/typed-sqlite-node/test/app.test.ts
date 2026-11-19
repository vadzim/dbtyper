// RUN-25: migrate a real SQLite (node:sqlite), run typed query and stream, check the rows.
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { createExampleApp } from "../src/sample-app.ts"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<_T extends true>() {}
/** node:sqlite rows have a null prototype; copy them so deepEqual compares plain objects. */
const plain = <R extends object>(rows: R[]): R[] => rows.map(row => ({ ...row }))

test("RUN-25: insert returning with ? parameters, nullable and JSON columns", async () => {
	const { app, sqlite } = await createExampleApp()
	const rows = await app.query("insert into users (name, email, profile) values (?, ?, ?) returning id, name", [
		"ann",
		null,
		JSON.stringify({ theme: "dark" }),
	])
	assertType<Equal<typeof rows, Array<{ id: number; name: string }>>>()
	assert.deepEqual(plain(rows), [{ id: 1, name: "ann" }])

	const [user] = await app.query("select id, name, email, profile from users where id = :id", { id: 1 })
	assertType<Equal<typeof user, { id: number; name: string; email: string | null; profile: string } | undefined>>()
	assert.equal(user?.email, null)
	assert.deepEqual(JSON.parse(user?.profile ?? ""), { theme: "dark" })
	sqlite.close()
})

test("RUN-25: :name and @name parameters, rowid, update returning", async () => {
	const { app, sqlite } = await createExampleApp()
	await app.query("insert into users (name, email, profile) values (:name, :email, :profile)", {
		name: "bob",
		email: "bob@example.com",
		profile: "{}",
	})
	const byName = await app.query("select rowid as rid, id, email from users where name = @name", { name: "bob" })
	assertType<Equal<typeof byName, Array<{ rid: number; id: number; email: string | null }>>>()
	assert.deepEqual(plain(byName), [{ rid: 1, id: 1, email: "bob@example.com" }])

	const updated = await app.query("update users set email = @email where id = @id returning id, email", {
		email: null,
		id: 1,
	})
	assert.deepEqual(plain(updated), [{ id: 1, email: null }])
	sqlite.close()
})

test("RUN-25: stream over a temp-file database that migrates once", async () => {
	const dir = mkdtempSync(join(tmpdir(), "dbtyper-sqlite-"))
	try {
		const file = join(dir, "app.db")
		const first = await createExampleApp(file)
		for (const name of ["a", "b", "c"]) {
			await first.app.query("insert into users (name, profile) values (?, ?)", [name, "{}"])
		}
		first.sqlite.close()

		const second = await createExampleApp(file) // already migrated: nothing is applied twice
		const names: string[] = []
		for await (const row of await second.app.stream("select id, name from users order by id")) {
			assertType<Equal<typeof row, { id: number; name: string }>>()
			names.push(row.name)
		}
		assert.deepEqual(names, ["a", "b", "c"])
		second.sqlite.close()
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
