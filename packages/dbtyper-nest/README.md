# dbtyper-nest

NestJS integration for [dbtyper](../../README.md): registers a compiled logical database by id and exposes a matching injection decorator.

See [DESIGN.md](./DESIGN.md) for boundaries and lifecycle.

## Install

Peer dependencies: `@nestjs/common` and `@nestjs/core` ^10 or ^11, `dbtyper`, and **`postgres`** when using **`postgresSqlDriver`** from **`dbtyper/postgres`**.

```bash
npm install dbtyper-nest @nestjs/common dbtyper postgres
```

## Usage

```typescript
import { Module } from "@nestjs/common"

import { DbtyperModule } from "dbtyper-nest"
import { postgresSqlDriver } from "dbtyper/postgres"
import { exampleDb } from "./example-schema.js"

@Module({
	imports: [
		DbtyperModule.forRootAsync({
			id: "EXAMPLE_DB_ID",
			imports: [PostgresModule], // some module providing postgres client
			inject: [POSTGRES], // some id with provided postgres client
			useFactory: (sql: PostgresClient) => exampleDb(postgresSqlDriver({ sql })),
		}),
	],
})
export class AppModule {}
```

Create and close the `postgres` client in your app module or a dedicated provider; `dbtyper-nest` only consumes the connected instance to build the typed database.
If you omit `id`, the module and decorator use the built-in default id internally.

Inject the database:

```typescript
import { InjectDbtyper } from "dbtyper-nest"
import type { DataBase } from "dbtyper"

@Injectable()
export class UsersService {
	constructor(@InjectDbtyper(DBTYPER_ID) private readonly db: DataBase<MyDbShape>) {}

	async listEmails() {
		return this.db.query("select email from auth.users;")
	}
}
```
