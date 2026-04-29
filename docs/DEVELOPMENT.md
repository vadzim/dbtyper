# Development

Notes for working on this repository: toolchain, packaging, and internal conventions.

## Toolchain

This project targets **TypeScript 7.0 preview**.

## npm package

The registry package is **compiled** (`dist/`) so Node can load `.js` from `node_modules`.

- **Build:** `npm run build` (runs `tsc -p tsconfig.build.json`).
- **Pack / publish:** `npm pack` or `npm publish` runs **`prepack`**, which runs the build first.

```ts
import { sqlDatabase, migration, patch } from "typesql"
import type { ApplyStatements, ParseSqlTokens, JsqlDatabaseShape, MigrationExport } from "typesql"
```

Use **`migration()`** for normal DDL/DML you export as versioned migrations; use **`patch()`** only for compile-time parity SQL that must not appear in that export list — see [`MIGRATIONS.md`](./MIGRATIONS.md).

For **PostgreSQL** at runtime (typed `query` / `stream` with the [postgres](https://github.com/porsager/postgres) client), see [`../articles/TYPED_POSTGRES_AND_TYPESQL.md`](../articles/TYPED_POSTGRES_AND_TYPESQL.md) and the workspace under [`../examples/typed-postgres/`](../examples/typed-postgres/).

## Performance rule

Type-level utilities in this project are helpers and must never become the bottleneck.

- Prefer the cheapest type-level operations that still give useful inference.
- Put heavy or diagnostic-only type features behind explicit opt-in helper types.

## Parser rule

Parsers must work directly on `TokensList` and report errors as soon as they are knowable.

- Do not collect inner SQL text into a string or `string[]` buffer and then parse that buffer later.
- Do not delay parse errors until after a matching closing bracket is found if the error can be detected earlier while traversing tokens.
- When parsing bracketed structures like column lists, value lists, or `CREATE TABLE` bodies, build the target structure directly during token traversal and return the remaining token tail.
