import type { Database } from "better-sqlite3"

import { migrationModules } from "./example-schema.ts"

/** Applies the migration modules not yet applied; `PRAGMA user_version` is the number applied so far. */
export async function migrate(db: Database): Promise<number> {
	const row = db.prepare("pragma user_version").get() as { user_version: number }
	for (const [index, load] of migrationModules.entries()) {
		if (index < row.user_version) {
			continue
		}
		const { generateSql } = await load()
		db.exec("begin")
		try {
			db.exec(generateSql())
			db.exec(`pragma user_version = ${index + 1}`)
			db.exec("commit")
		} catch (error) {
			db.exec("rollback")
			throw error
		}
	}
	return migrationModules.length
}
