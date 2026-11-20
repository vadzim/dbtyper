// The lexer's quoting rules against the shared cases of the run-time scanner (test/test-utils/scanner-cases.ts).
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import type { TestTokensL } from "../test-utils/lexer-test-utils.ts"
import type { scannerCases } from "../test-utils/scanner-cases.ts"

type SyntaxOf<D> = D extends "sqlite" ? "question-params" | "dialect:sqlite" : "named-params" | "dialect:postgres"

type CountParams<Tokens extends unknown[], N extends unknown[] = []> = Tokens extends [infer T, ...infer Rest]
	? CountParams<Rest, T extends { kind: "param" | "indexed_param" } ? [...N, 1] : N>
	: N["length"]

type Agrees<C> = C extends { dialect: infer D; sql: infer S extends string; params: infer N }
	? CountParams<TestTokensL<CreateParserMonad<S, SyntaxOf<D>>>[1]> extends N
		? true
		: { disagrees: S }
	: never

export const lexerAgreesWithScanner: [Agrees<(typeof scannerCases)[number]>] extends [true] ? true : never = true
