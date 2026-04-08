In this project we use typescript 7.0 preview.

This project is a typescript types which parses sql strings and returns prope types.

You can also build a full database schema from multiple `SqlCreateTable` types:

```ts
import { SqlCreateTable, SqlDatabase } from "./sql.ts"

type UsersTable = SqlCreateTable<"create table users (id int not null, email text not null)">
type PostsTable = SqlCreateTable<"create table posts (id int not null, user_id int not null, title text)">

type Db = SqlDatabase<[UsersTable, PostsTable]>
```

`Db` becomes:

```ts
{
	users: {
		id: number
		email: string
	}
	posts: {
		id: number
		user_id: number
		title: string | null
	}
}
```

If any table SQL is invalid or table names are duplicated, the result is `SqlParseError<...>`.

## Performance Rule

Type-level utilities in this project are helpers and must never become the bottleneck.

- Prefer the cheapest type-level operations that still give useful inference.
- Keep `SqlCreateTable["source"]` as the original input literal by default.
- Avoid expensive template-literal reconstruction or formatting work unless it is required.
- Put heavy or diagnostic-only type features behind explicit opt-in helper types.
