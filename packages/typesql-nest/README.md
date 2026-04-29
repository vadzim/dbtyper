# @typesql/nest

NestJS integration for [typesql](../../README.md): registers a compiled logical database by id and exposes a matching injection decorator.

See [DESIGN.md](./DESIGN.md) for boundaries and lifecycle.

## Install

Peer dependencies: `@nestjs/common` and `@nestjs/core` ^10 or ^11, `typesql`, and **`postgres`** when using **`postgresSqlDriver`** from **`typesql/postgres`**.

```bash
npm install @typesql/nest @nestjs/common typesql postgres
```

## Usage

```typescript
import { Module } from "@nestjs/common"

import { TypesqlModule } from "@typesql/nest"
import { postgresSqlDriver } from "typesql/postgres"
import { exampleDb } from "./example-schema.js"

@Module({
	imports: [
		TypesqlModule.forRootAsync({
			id: "EXAMPLE_DB_ID",
			imports: [PostgresModule], // some module providing postgres client
			inject: [POSTGRES], // some id with provided postgres client
			useFactory: (sql: PostgresClient) => exampleDb(postgresSqlDriver({ sql })),
		}),
	],
})
export class AppModule {}
```

Create and close the `postgres` client in your app module or a dedicated provider; `@typesql/nest` only consumes the connected instance to build the typed database.
If you omit `id`, the module and decorator use the built-in default id internally.

Inject the database:

```typescript
import { InjectTypesql } from "@typesql/nest"
import type { DataBase } from "typesql"

@Injectable()
export class UsersService {
	constructor(@InjectTypesql(TYPESQL_ID) private readonly db: DataBase<MyDbShape>) {}

	async listEmails() {
		return this.db.query("select email from auth.users;")
	}
}
```
