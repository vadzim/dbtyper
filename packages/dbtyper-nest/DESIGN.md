# dbtyper-nest — design

## Boundaries

- **dbtyper** stays responsible for compile-time `JsqlDatabaseShape`, `CompiledDataBase`, and `SqlDriver`.
- **Nest** supplies dependency injection and async bootstrap (`forRootAsync`).
- The application owns external resources such as the `postgres` client and closes them outside `dbtyper-nest`.

The connector does not parse SQL or own migrations; applications keep `sqlDatabase({ driver }).apply(…).database()` (or equivalent) in a factory and pass `{ database }`.
The module binds each connection by `id`; `InjectDbtyper(id)` resolves the matching database provider, and the default id is internal to `dbtyper-nest`.

## Flow

1. Application factory resolves a typed `database` value from `database()` (after **`sqlDatabase({ driver: postgresSqlDriver({ sql }) })`** or equivalent).
2. The module registers one database provider keyed by the chosen `id`.
3. `InjectDbtyper(id)` resolves that provider.

## Multi-database (future)

Register multiple dynamic modules with distinct injection tokens by duplicating the pattern with custom `provide` keys or a parameterized `forRootAsync({ token: … })` extension; the current API targets a single global dbtyper connection (`global: true`).

## Testing

Use **`forRoot`** with an in-memory / mocked **`SqlDriver`**.
