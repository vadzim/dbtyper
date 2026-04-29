import "reflect-metadata"

import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypesqlModule } from "@typesql/nest"
import { postgresSqlDriver } from "typesql/postgres"

import { exampleDb } from "./example-schema.ts"
import { POSTGRES, PostgresModule, type PostgresClient } from "./postgres.module.ts"
import { UsersModule } from "./users/users.module.ts"
import { TYPESQL_ID } from "./typesql-connection.ts"

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		PostgresModule,

		TypesqlModule.forRootAsync({
			id: TYPESQL_ID,
			imports: [PostgresModule],
			inject: [POSTGRES],
			useFactory: (sql: PostgresClient) => exampleDb(postgresSqlDriver({ sql })),
		}),

		UsersModule,
	],
})
export class AppModule {}
