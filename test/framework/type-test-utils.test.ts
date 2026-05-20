import { describe, it } from "node:test"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type A1 = { a: 1 }
type A2 = { a: 2 }
type AAny = { a: any }
type ANever = { a: never }
type AUnknown = { a: unknown }

expectType<A1>(toBe<A1>())

expectType<A1>(
	// @ts-expect-error
	toBe<A2>(),
)

expectType<A1>(
	// @ts-expect-error
	toBe<AUnknown>(),
)

expectType<AUnknown>(
	// @ts-expect-error
	toBe<A1>(),
)

expectType<A1>(
	// @ts-expect-error
	toBe<AAny>(),
)

expectType<AAny>(
	// @ts-expect-error
	toBe<A1>(),
)

expectType<AAny>(
	// @ts-expect-error
	toBe<AAny>(),
)

expectType<ANever>(
	// @ts-expect-error
	toBe<ANever>(),
)

expectType<ANever>(
	// @ts-expect-error
	toBe<AAny>(),
)

expectType<AAny>(
	// @ts-expect-error
	toBe<ANever>(),
)

describe("type test utils", () => {
	it("should run", () => {})
})
