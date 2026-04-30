import "reflect-metadata"

import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { DbtyperModule } from "dbtyper-nest"
import { postgresSqlDriver } from "dbtyper/postgres"

import { exampleDb } from "./example-schema.ts"
import { POSTGRES, PostgresModule, type PostgresClient } from "./postgres.module.ts"
import { UsersModule } from "./users/users.module.ts"
import { DBTYPER_ID } from "./dbtyper-connection.ts"

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		PostgresModule,

		DbtyperModule.forRootAsync({
			id: DBTYPER_ID,
			imports: [PostgresModule],
			inject: [POSTGRES],
			useFactory: (sql: PostgresClient) => exampleDb(postgresSqlDriver({ sql })),
		}),

		UsersModule,
	],
})
export class AppModule {}
