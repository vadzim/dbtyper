# typesql

In this project we use TypeScript 7.0 preview.

**typesql** is a set of TypeScript types that parse SQL strings and return proper types.

**Where to look next:** supported surface area is summarized in [`SUPPORTED-SQL.md`](SUPPORTED-SQL.md). A short gap analysis vs the goal lives in [`CURRENT.md`](CURRENT.md). For **published** installs, import from the `typesql` package (see below). In-repo, the minimal type barrel is still [`core/sql.ts`](core/sql.ts); statement-level typing lives under `src/parser/` (e.g. [`src/parser/parse-sql-statement.ts`](src/parser/parse-sql-statement.ts)).

## npm package

The registry package is **compiled** (`dist/`) so Node can load `.js` from `node_modules`.

- **Build:** `npm run build` (runs `tsc -p tsconfig.build.json`).
- **Pack / publish:** `npm pack` or `npm publish` runs **`prepack`**, which runs the build first.

```ts
import { sqlDatabase, migration } from "typesql"
import type { ApplyStatements, ParseSqlTokens, JsqlDatabaseShape } from "typesql"
```

For **PostgreSQL** at runtime (typed `query` / `stream` with the [postgres](https://github.com/porsager/postgres) client), see [`articles/TYPED_POSTGRES_AND_TYPESQL.md`](articles/TYPED_POSTGRES_AND_TYPESQL.md) and the workspace under [`examples/typed-postgres/`](examples/typed-postgres/).

## Goal

The goal is **not** to implement a database with row values or query results living in the type system.

The goal is **type-safe queries against a schema**: when you add or change a migration, any query that no longer matches the catalog (wrong tables or columns, bad nullability, incompatible expressions, and similar) should become a **TypeScript type error**, so incompatibilities surface at compile time—not only when you run the app.

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
- Put heavy or diagnostic-only type features behind explicit opt-in helper types.

## Parser Rule

Parsers must work directly on `TokensList` and report errors as soon as they are knowable.

- Do not collect inner SQL text into a string or `string[]` buffer and then parse that buffer later.
- Do not delay parse errors until after a matching closing bracket is found if the error can be detected earlier while traversing tokens.
- When parsing bracketed structures like column lists, value lists, or `CREATE TABLE` bodies, build the target structure directly during token traversal and return the remaining token tail.
