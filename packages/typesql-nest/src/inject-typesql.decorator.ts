import { Inject } from "@nestjs/common"

import { TYPESQL_CONNECTED } from "./typesql.constants.ts"

/** Parameter decorator: inject the connected typesql database ({@link TYPESQL_CONNECTED}). */
export function InjectTypesql(): ParameterDecorator {
	return Inject(TYPESQL_CONNECTED)
}
