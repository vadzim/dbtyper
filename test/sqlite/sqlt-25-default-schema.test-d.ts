// SQLT-25: SQLite has no schemas; a defaultSchema other than main / temp is a compile error
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"

sqlMigrations({ driver: sqliteMockDriver })
sqlMigrations({ driver: sqliteMockDriver, defaultSchema: "main" })
sqlMigrations({ driver: sqliteMockDriver, defaultSchema: "temp" })
// @ts-expect-error SQLite has no schemas (4108)
sqlMigrations({ driver: sqliteMockDriver, defaultSchema: "app" })

// PostgreSQL keeps any name
sqlMigrations({ driver: mockDriver, defaultSchema: "app" })
