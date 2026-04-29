import "reflect-metadata"

import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import postgres from "postgres"
import { TypesqlModule, type TypesqlRootConfig } from "@typesql/nest"

import { compileExampleDb } from "./example-schema.ts"
import { postgresSqlDriver } from "./postgres-driver.ts"
import { UsersModule } from "./users/users.module.ts"

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
		UsersModule,
	],
})
export class AppModule {}
