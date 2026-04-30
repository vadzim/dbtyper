import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.ts"
import { createTestDatabase } from "./migrations.data.1/index.ts"

describe("migration query type inference", () => {
	it("infers row types for joined queries after applying migrations", async () => {
		const db = await createTestDatabase()

		const statement = `
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
		` as const

		const rows = await db.query<typeof statement, { email_domain: { ts: string; sql: "text" } }>(statement, {
			email_domain: "@example\\.com$",
		})

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
