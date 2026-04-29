# @typesql/nest

NestJS integration for [typesql](../../README.md): registers a compiled logical database and its `SqlDriver`, exposes `CompiledDataBase` / `ConnectedDataBase` injection tokens, and tears down the DB client on application shutdown.

See [DESIGN.md](./DESIGN.md) for boundaries and lifecycle.

## Install

Peer dependencies: `@nestjs/common` and `@nestjs/core` ^10 or ^11, and `typesql`.

```bash
npm install @typesql/nest @nestjs/common typesql
```

## Usage

```typescript
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import postgres from "postgres"

import { TypesqlModule, type TypesqlRootConfig } from "@typesql/nest"
import { compileExampleDb } from "./example-schema.js"
import { postgresSqlDriver } from "./postgres-driver.js"

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		TypesqlModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (config: ConfigService): Promise<TypesqlRootConfig> => {
				const compiled = await compileExampleDb()
				const sql = postgres(config.getOrThrow<string>("DATABASE_URL"), { max: 10 })
				return {
					compiled,
					driver: postgresSqlDriver(sql),
					onShutdown: sql,
				}
			},
		}),
	],
})
export class AppModule {}
```

Inject the connected DB:

```typescript
import { InjectTypesql } from "@typesql/nest"
import type { ConnectedDataBase } from "typesql"

@Injectable()
export class UsersService {
	constructor(@InjectTypesql() private readonly db: ConnectedDataBase<MyDbShape>) {}

	async listEmails() {
		return this.db.query("select email from auth.users;")
	}
}
```

Use `TYPESQL_COMPILED` / `TYPESQL_CONNECTED` if you prefer `@Inject(Symbol)` over `@InjectTypesql()`.
