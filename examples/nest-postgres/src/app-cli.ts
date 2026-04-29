import { createExampleApp } from "./sample-app.ts"

const url = process.env.DATABASE_URL
if (url === undefined || url === "") {
	console.error("Set DATABASE_URL (see .env.example).")
	process.exit(1)
}

const { app, sql } = await createExampleApp(url)

try {
	const stmt = `
		select
			public.agenda.*,
			email,
			display_name
		from public.agenda
		inner join auth.users
		on auth.users.id = public.agenda.user_id
		where email ~ :email_domain
		order by display_name asc
	` as const

	const rows = await app.query<typeof stmt, { email_domain: { ts: string; sql: "text" } }>(stmt, {
		email_domain: "@example\\.com$",
	})
	console.log("users (typed rows from typesql + postgres):")
	for (const row of rows) {
		console.log(`  ${row.email}\t${row.display_name ?? ""}`)
	}
} finally {
	await sql.end({ timeout: 5 })
}
