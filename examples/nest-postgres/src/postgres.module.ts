import { Inject, Injectable, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import postgres from "postgres"

export const POSTGRES = Symbol("POSTGRES")

export type PostgresClient = ReturnType<typeof postgres>

@Injectable()
class PostgresLifecycle {
	constructor(@Inject(POSTGRES) private readonly sql: PostgresClient) {}

	async onModuleDestroy(): Promise<void> {
		await this.sql.end({ timeout: 10 })
	}
}

@Module({
	providers: [
		{
			provide: POSTGRES,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => postgres(config.getOrThrow<string>("DATABASE_URL"), { max: 10 }),
		},
		PostgresLifecycle,
	],
	exports: [POSTGRES],
})
export class PostgresModule {}
