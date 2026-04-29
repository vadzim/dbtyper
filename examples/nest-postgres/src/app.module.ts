import "reflect-metadata"

import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypesqlModule } from "@typesql/nest"
import postgres from "postgres"
import { postgresSqlDriver } from "typesql/postgres"

import { exampleDb } from "./example-schema.ts"
import { UsersModule } from "./users/users.module.ts"

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
		UsersModule,
	],
})
export class AppModule {}
