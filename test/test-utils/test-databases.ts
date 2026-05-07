import type { PostgresTypeMap } from "../../src/postgres/postgres-type-map.ts"
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

export const mockDriver = {
	query: async () => [],
	scalarTypes: {} as PostgresTypeMap,
}
