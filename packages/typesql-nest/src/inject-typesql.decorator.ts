import { Inject } from "@nestjs/common"

import { TYPESQL_DATABASE } from "./typesql.constants.ts"

/** Parameter decorator: inject the connected typesql database ({@link TYPESQL_DATABASE}). */
export function InjectTypesql(): ParameterDecorator {
	return Inject(TYPESQL_DATABASE)
}
