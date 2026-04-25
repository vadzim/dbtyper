In this project we use typescript 7.0 preview.

This project is a typescript types which parses sql strings and returns prope types.

You can build a schema from multiple `SqlCreateTable` types, then build a database from schemas:

```ts
import { SqlCreateTable, SqlSchema, SqlDatabase } from "./src/sql.ts"

type UsersTable = SqlCreateTable<"create table users (id int not null, email text not null)">
type PostsTable = SqlCreateTable<"create table posts (id int not null, user_id int not null, title text)">

type PublicSchema = SqlSchema<[UsersTable, PostsTable]>
type Db = SqlDatabase<{ public: PublicSchema }>
```

`Db` becomes:

```ts
{
	schemas: {
		public: {
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
	}
}
```

Checks:

- `SqlSchema` checks duplicate table names and foreign key references inside the same schema.
- `SqlDatabase` checks foreign key references that point to another schema (for example `references public.users(id)`).
- Any invalid case returns `SqlParserError<...>`.

## Performance Rule

Type-level utilities in this project are helpers and must never become the bottleneck.

- Prefer the cheapest type-level operations that still give useful inference.
- Keep `SqlCreateTable["source"]` as the original input literal by default.
- Avoid expensive template-literal reconstruction or formatting work unless it is required.
- Put heavy or diagnostic-only type features behind explicit opt-in helper types.

## Parser Rule

Parsers must work directly on `TokensList` and report errors as soon as they are knowable.

- Do not collect inner SQL text into a string or `string[]` buffer and then parse that buffer later.
- Do not delay parse errors until after a matching closing bracket is found if the error can be detected earlier while traversing tokens.
- When parsing bracketed structures like column lists, value lists, or `CREATE TABLE` bodies, build the target structure directly during token traversal and return the remaining token tail.
