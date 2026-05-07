import type { PostgresTypeMap } from "../../src/postgres/postgres-type-map.ts"

export type DbPublicUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: {
						id: "number"
						name: "text"
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
