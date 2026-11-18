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

/**
 * A SQLite-dialect test driver (DSEL-1): the real SQLite drivers and type map come with the SQLite issues;
 * this config only has the dialect and the few types the dialect tests need.
 */
export type SqliteMockDriverConfig = {
	dialect: "sqlite"
	scalarTypes: { integer: number; int: number; text: string; real: number }
	syntax: "named-params" | "question-params"
}

export const sqliteMockDriver = createDriver<SqliteMockDriverConfig>({ query: async () => [] })
