import { createExampleApp } from "./sample-app.ts"

const url = process.env.DATABASE_URL
if (url === undefined || url === "") {
	console.error("Set DATABASE_URL (see .env.example).")
	process.exit(1)
}

const { app, sql } = await createExampleApp(url)

try {
	const rows = await app.query(`
		select
			public.agenda.*,
			email,
			display_name,
			auth.users.created_at,
			auth.users.login_count
		from auth.users
		left join public.agenda
		on auth.users.id = public.agenda.user_id
		order by email;
	`)
	console.log("users (typed rows from dbtyper + postgres):")
	for (const row of rows) {
		console.log(`  ${row.email}\t${row.display_name ?? ""}\t${row.title}`, row)
	}
} finally {
	await sql.end({ timeout: 5 })
}
