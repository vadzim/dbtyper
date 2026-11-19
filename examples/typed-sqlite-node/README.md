# typed-sqlite-node example

SQLite through Node's built-in `node:sqlite` (`DatabaseSync`), typed by dbtyper's `dbtyper/sqlite` entry point. No Docker, no server: the tests migrate a real in-memory or temp-file database. Spec: RUN-25.

```bash
npm install
npm test        # build dbtyper if needed, typecheck, node --test, prettier check
npm run demo    # insert, then stream rows
```

Needs Node 22.13+ (`node:sqlite`; it prints an experimental warning on some versions).

## Layout

- `migrations/*.do.*.js` — SQL strings via `migration(...)`; one `generateSql()` per file
- `src/example-schema.ts` — the list of modules, and `exampleDb(driver)`, which feeds the same SQL to `sqlMigrations(...).apply(...)` for the types
- `src/migrate.ts` — the runtime runner: runs the same modules against the file, `PRAGMA user_version` counts what was applied
- `src/sample-app.ts` — opens the database, migrates it, wires `nodeSqliteDriver(db)`
- `test/app.test.ts` — migrates, runs typed queries, checks rows and (with `assertType`) the inferred types

## The code and its typed results

Schema (`migrations/001.do.users.js`): `users (id integer primary key, name text not null, email text, profile json not null)`.

```ts
import { DatabaseSync } from "node:sqlite"
import { nodeSqliteDriver } from "dbtyper/sqlite"

const sqlite = new DatabaseSync(":memory:")
await migrate(sqlite)
const app = await exampleDb(nodeSqliteDriver(sqlite))
```

`?` parameters (an array), `INSERT … RETURNING`:

```ts
const rows = await app.query("insert into users (name, email, profile) values (?, ?, ?) returning id, name", [
	"ann",
	null, // email is nullable: null is accepted
	JSON.stringify({ theme: "dark" }),
])
// rows: { id: number; name: string }[]
```

`:name` parameters (an object keyed by the bare name), a nullable column and a JSON column:

```ts
const [user] = await app.query("select id, name, email, profile from users where id = :id", { id: 1 })
// user: { id: number; name: string; email: string | null; profile: string } | undefined
JSON.parse(user.profile) // a JSON column is TEXT in SQLite: typed string, parse it yourself
```

`@name` parameters and the rowid (alias it, see below):

```ts
const byName = await app.query("select rowid as rid, id, email from users where name = @name", { name: "bob" })
// byName: { rid: number; id: number; email: string | null }[]
```

`stream` gives an async iterable of typed rows:

```ts
for await (const row of await app.stream("select id, name from users order by id")) {
	// row: { id: number; name: string }
}
```

## Notes

- `node:sqlite` rows have a null prototype; the tests copy them with `{ ...row }` before `deepEqual`.
- On a table with `INTEGER PRIMARY KEY`, SQLite names a bare `rowid` result column after the key (`id`), while the type says `rowid`. The example aliases it (`rowid as rid`), which is the same at runtime and in the type.
- The `test` script builds the root package once (`dist/`), because the runtime import of `dbtyper` resolves to the built files; the type check uses the sources through `paths`.
