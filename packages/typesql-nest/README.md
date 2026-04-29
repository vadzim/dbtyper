# @typesql/nest

NestJS integration for [typesql](../../README.md): registers a compiled logical database, exposes a typed injection decorator, and tears down the DB client on application shutdown.

See [DESIGN.md](./DESIGN.md) for boundaries and lifecycle.

## Install

Peer dependencies: `@nestjs/common` and `@nestjs/core` ^10 or ^11, `typesql`, and **`postgres`** when using **`postgresSqlDriver`** from **`typesql/postgres`**.

```bash
npm install @typesql/nest @nestjs/common typesql postgres
```

## Usage

```typescript
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import postgres from "postgres"

import { TypesqlModule } from "@typesql/nest"
import { exampleDb } from "./example-schema.js"
import { postgresSqlDriver } from "typesql/postgres"

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		TypesqlModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (config: ConfigService) => {
				const sql = postgres(config.getOrThrow<string>("DATABASE_URL"), { max: 10 })
				const database = await exampleDb(postgresSqlDriver({ sql }))
				return {
					database,
					onShutdown: sql,
				}
			},
		}),
	],
})
export class AppModule {}
```

Inject the database:

```typescript
import { InjectTypesql } from "@typesql/nest"
import type { DataBase } from "typesql"

@Injectable()
export class UsersService {
	constructor(@InjectTypesql() private readonly db: DataBase<MyDbShape>) {}

	async listEmails() {
		return this.db.query("select email from auth.users;")
	}
}
```
