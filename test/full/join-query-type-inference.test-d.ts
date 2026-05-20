import { createTestDatabase } from "./migrations.data.1/index.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

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

const _rows = await db.query(statement, {
	email_domain: "@example\\.com$",
})

expectType<typeof _rows>(
	toBe<
		{
			agenda: string
			created_at: Date
			display_name: string
			email: string
			id: string
			login_count: number
			title: string
			user_id: string
		}[]
	>(),
)
