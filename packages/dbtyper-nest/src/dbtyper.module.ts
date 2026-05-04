import type { DynamicModule, ModuleMetadata, Provider } from "@nestjs/common"
import { Inject, Module } from "@nestjs/common"

const DEFAULT_DBTYPER_ID = Symbol()

export function InjectDbtyper(id: string | symbol = DEFAULT_DBTYPER_ID): ParameterDecorator {
	return Inject(id)
}

type DbtyperDatabase = {
	query: (...args: any[]) => Promise<unknown>
	stream: (...args: any[]) => Promise<AsyncIterable<unknown>>
}

type DbtyperModuleAsyncOptions = {
	id?: string | symbol
	imports?: ModuleMetadata["imports"]
	inject?: any[]
	useFactory: (...args: any[]) => DbtyperDatabase | Promise<DbtyperDatabase>
}

@Module({})
export class DbtyperModule {
	static forRoot(
		config: DbtyperDatabase | Promise<DbtyperDatabase>,
		id: string | symbol = DEFAULT_DBTYPER_ID,
	): DynamicModule {
		const databaseProvider: Provider = {
			provide: id,
			useFactory: async () => await Promise.resolve(config),
		}
		return DbtyperModule.withProviders(id, databaseProvider, undefined)
	}

	static forRootAsync(options: DbtyperModuleAsyncOptions): DynamicModule {
		const id = options.id ?? DEFAULT_DBTYPER_ID
		const databaseProvider: Provider = {
			provide: id,
			useFactory: options.useFactory,
			inject: options.inject ?? [],
		}
		return DbtyperModule.withProviders(id, databaseProvider, options.imports)
	}

	private static withProviders(
		token: string | symbol,
		databaseProvider: Provider,
		imports: ModuleMetadata["imports"] | undefined,
	): DynamicModule {
		return {
			module: DbtyperModule,
			global: true,
			imports: imports ?? [],
			providers: [databaseProvider],
			exports: [token],
		}
	}
}
