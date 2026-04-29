import type { DynamicModule, ModuleMetadata, Provider } from "@nestjs/common"
import { Module } from "@nestjs/common"

import { TYPESQL_DATABASE, TYPESQL_ROOT_OPTIONS } from "./typesql.constants.ts"
import type { TypesqlRootConfig } from "./typesql-root.config.ts"
import { TypesqlLifecycle } from "./typesql-lifecycle.service.ts"

export type TypesqlModuleAsyncOptions = {
	imports?: ModuleMetadata["imports"]
	inject?: any[]
	useFactory: (...args: any[]) => TypesqlRootConfig | Promise<TypesqlRootConfig>
}

@Module({})
export class TypesqlModule {
	static forRoot(config: TypesqlRootConfig | Promise<TypesqlRootConfig>): DynamicModule {
		const optionsProvider: Provider = {
			provide: TYPESQL_ROOT_OPTIONS,
			useFactory: async () => await Promise.resolve(config),
		}
		return TypesqlModule.withProviders(optionsProvider, undefined)
	}

	static forRootAsync(options: TypesqlModuleAsyncOptions): DynamicModule {
		const optionsProvider: Provider = {
			provide: TYPESQL_ROOT_OPTIONS,
			useFactory: options.useFactory,
			inject: options.inject ?? [],
		}
		return TypesqlModule.withProviders(optionsProvider, options.imports)
	}

	private static withProviders(
		optionsProvider: Provider,
		imports: ModuleMetadata["imports"] | undefined,
	): DynamicModule {
		return {
			module: TypesqlModule,
			global: true,
			imports: imports ?? [],
			providers: [
				optionsProvider,
				{
					provide: TYPESQL_DATABASE,
					useFactory: (root: TypesqlRootConfig) => root.database,
					inject: [TYPESQL_ROOT_OPTIONS],
				},
				TypesqlLifecycle,
			],
			exports: [TYPESQL_DATABASE],
		}
	}
}
