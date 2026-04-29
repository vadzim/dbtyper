import { Injectable } from "@nestjs/common"
import type { OnModuleDestroy } from "@nestjs/common"
import { ModuleRef } from "@nestjs/core"

import { TYPESQL_ROOT_OPTIONS } from "./typesql.constants.ts"
import type { TypesqlRootConfig } from "./typesql-root.config.ts"

/** No parameter decorators here so dev runners (e.g. tsx + esbuild) can load the package. */
@Injectable()
export class TypesqlLifecycle implements OnModuleDestroy {
	constructor(private readonly moduleRef: ModuleRef) {}

	async onModuleDestroy(): Promise<void> {
		const root = this.moduleRef.get<TypesqlRootConfig>(TYPESQL_ROOT_OPTIONS, { strict: true })
		const shutdown = root.onShutdown
		if (shutdown === undefined) {
			return
		}
		await shutdown.end({ timeout: 10 })
	}
}
