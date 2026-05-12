import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { Inc } from "../core/type-utils.ts"

/**
 * Parser state that gets threaded through all parsers.
 * Contains the database shape and tracks the current positional parameter index.
 */
export type ParserState = {
	db: JsqlDatabaseShape
	positionalParamIndex: number
}

/**
 * Initial parser state with positional parameter index set to 0.
 */
export type InitialParserState<Db extends JsqlDatabaseShape> = {
	db: Db
	positionalParamIndex: 0
}

/**
 * Increments the positional parameter index in the parser state.
 */
export type IncrementPositionalParamIndex<State extends ParserState> = {
	db: State["db"]
	positionalParamIndex: Inc[State["positionalParamIndex"]]
}
