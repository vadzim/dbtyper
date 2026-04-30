import { describe, it } from "node:test"
import type { PostgresTypeMap } from "../../src/postgres/index.ts"
import type { Expect, Matches } from "../test-utils/type-test-utils.ts"
import { sqlMigrations } from "../../src/core/sql-database.ts"

describe("migration query type inference", () => {
	it("infers row types for joined queries after applying migrations", async () => {
		const m = sqlMigrations({
			driver: {
				query: async () => [],
				async *stream() {},
				scalarTypes: {} as PostgresTypeMap,
			},
		})
		const m2 = m.apply((await import("./migrations.data.1/001.do.schemas.js")).generateSql())
		const m3 = m2.apply((await import("./migrations.data.1/002.do.users.js")).generateSql())
		const m4 = m3.apply((await import("./migrations.data.1/003.do.agenda.js")).generateSql())
		const m5 = m4.apply((await import("./migrations.data.1/004.do.seed_users.js")).generateSql())
		const db = m5.database()

		const rows = await db.query(
			`
            select
                public.agenda.*,
                email,
                display_name,
                auth.users.created_at,
                auth.users.login_count
            from auth.users
            left join public.agenda
            on auth.users.id = public.agenda.user_id
			where auth.users.email ~ :email_domain
            order by email;
        `,
			{ email_domain: "@example\\.com$" },
		)

		type RowType = (typeof rows)[number]

		type _expected = Expect<
			Matches<
				RowType,
				{
					agenda: string
					created_at: Date
					display_name: string
					email: string
					id: string
					login_count: number
					title: string
					user_id: string
				}
			>
		>
	})
})
