import { createExampleApp } from "./sample-app.ts"

const { app, sqlite } = await createExampleApp()

const [ann] = await app.query("insert into users (name, email, profile) values (?, ?, ?) returning id, name", [
	"ann",
	null,
	JSON.stringify({ theme: "dark" }),
])
console.log("inserted:", ann)
for await (const row of await app.stream("select id, name, email from users order by id")) {
	console.log("stream row:", row)
}
sqlite.close()
