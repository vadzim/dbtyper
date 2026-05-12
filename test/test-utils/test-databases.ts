import { createDriver } from "../../src/core/sql-database.ts"
import type { PostgresDriverConfig } from "../../src/postgres/postgres-sql-driver.ts"
import type { TText, TInteger } from "./sql-type-helpers.ts"

export type DbPublicUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: {
						id: TInteger
						name: TText
					}
				}
			}
		}
	}
}

export const mockDriver = createDriver<PostgresDriverConfig>({ query: async () => [] })
