import { createDriver } from "../../src/core/sql-database.ts"
import { type LexerFeatures } from "../../src/lexer/sql-lexer.ts"
import { type PostgresTypeMap } from "../../src/postgres/postgres-type-map.ts"
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

export type MockDriverConfig = {
	dialect: "postgres"
	scalarTypes: PostgresTypeMap
	syntax: LexerFeatures
}

export const mockDriver = createDriver<MockDriverConfig>({ query: async () => [] })
