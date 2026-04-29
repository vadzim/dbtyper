import type { DynamicModule, ModuleMetadata, Provider } from "@nestjs/common"
import { Inject, Module } from "@nestjs/common"

const DEFAULT_TYPESQL_ID = Symbol()

export function InjectTypesql(id: string | symbol = DEFAULT_TYPESQL_ID): ParameterDecorator {
	return Inject(id)
}

type TypesqlDatabase = {
	query: (...args: any[]) => Promise<Array<unknown>>
	stream: (...args: any[]) => AsyncIterable<unknown>
}

type TypesqlModuleAsyncOptions = {
	id?: string | symbol
	imports?: ModuleMetadata["imports"]
	inject?: any[]
	useFactory: (...args: any[]) => TypesqlDatabase | Promise<TypesqlDatabase>
}

@Module({})
export class TypesqlModule {
	static forRoot(
		config: TypesqlDatabase | Promise<TypesqlDatabase>,
		id: string | symbol = DEFAULT_TYPESQL_ID,
	): DynamicModule {
		const databaseProvider: Provider = {
			provide: id,
			useFactory: async () => await Promise.resolve(config),
		}
		return TypesqlModule.withProviders(id, databaseProvider, undefined)
	}

	static forRootAsync(options: TypesqlModuleAsyncOptions): DynamicModule {
		const id = options.id ?? DEFAULT_TYPESQL_ID
		const databaseProvider: Provider = {
			provide: id,
			useFactory: options.useFactory,
			inject: options.inject ?? [],
		}
		return TypesqlModule.withProviders(id, databaseProvider, options.imports)
	}

	private static withProviders(
		token: string | symbol,
		databaseProvider: Provider,
		imports: ModuleMetadata["imports"] | undefined,
	): DynamicModule {
		return {
			module: TypesqlModule,
			global: true,
			imports: imports ?? [],
			providers: [databaseProvider],
			exports: [token],
		}
	}
}
