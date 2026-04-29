# @typesql/nest — design

## Boundaries

- **typesql** stays responsible for compile-time `JsqlDatabaseShape`, `CompiledDataBase`, and `SqlDriver`.
- **Nest** supplies dependency injection, async bootstrap (`forRootAsync`), and **shutdown** (`OnModuleDestroy`) so drivers such as `postgres` can call `end()`.
- **`TypesqlLifecycle`** uses **`ModuleRef`** to read `TYPESQL_ROOT_OPTIONS` (no parameter decorators on the token) so dev runners that transform the library with **esbuild** (e.g. **tsx**) can load `@typesql/nest` without enabling legacy parameter-decorator parsing in the bundler.

The connector does not parse SQL or own migrations; applications keep `sqlDatabase(…).apply(…).compile()` (or equivalent) in a factory and pass `{ compiled, driver, onShutdown }`.

## Flow

1. Application factory resolves **`TypesqlRootConfig`**: `compiled` from `compile()`, **`driver`** from an adapter (e.g. `postgres` → `SqlDriver`), optional **`onShutdown`** handle with `end()`.
2. The module registers **one** shared options provider (single factory invocation).
3. Derived providers expose **`TYPESQL_COMPILED`** and **`TYPESQL_CONNECTED`** (`compiled.connect(driver)`).
4. **`TypesqlLifecycle`** runs **`onShutdown`** when the Nest application closes.

## Multi-database (future)

Register multiple dynamic modules with distinct injection tokens by duplicating the pattern with custom `provide` keys or a parameterized `forRootAsync({ token: … })` extension; the current API targets a single global typesql connection (`global: true`).

## Testing

Use **`forRoot`** with an in-memory / mocked **`SqlDriver`** and omit **`onShutdown`**, or stub **`onShutdown.end`**.
