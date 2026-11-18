// The shared LR driver on hand-written toy tables (the encoding is described in scripts/gram/xml2ts.ts's output header).
import type { Recognize } from "../../src/gram/driver.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

// S: id id   (reduce with two pops, goto)
type Pair = {
	Actions: {
		0: { id: 1 }
		1: { id: 2 }
		2: { $default: [[unknown, unknown], "S"] }
		3: { $end: "accept" }
	}
	Gotos: { 0: { S: 3 } }
}

{
	type test = Recognize<Pair, ["id", "id"]>
	expectType<test>(toBe<{ ok: true }>())
}
{
	type test = Recognize<Pair, ["id"]>
	expectType<test>(toBe<{ ok: false; at: 1; token: "$end" }>())
}
{
	type test = Recognize<Pair, ["id", "id", "id"]>
	expectType<test>(toBe<{ ok: false; at: 2; token: "id" }>())
}
{
	type test = Recognize<Pair, []>
	expectType<test>(toBe<{ ok: false; at: 0; token: "$end" }>())
}

// S: A ';'   A: B   B: id   (state 1 is a collapsed run of the two unit reductions: with state 0 below, it ends in state 3)
type Chain = {
	Actions: {
		0: { id: 1 }
		1: { $default: { 0: 3 } }
		3: { ";": 5 }
		5: { $end: "accept" }
	}
	Gotos: {}
}

{
	type test = Recognize<Chain, ["id", ";"]>
	expectType<test>(toBe<{ ok: true }>())
}
{
	type test = Recognize<Chain, ["id", "id"]>
	expectType<test>(toBe<{ ok: false; at: 1; token: "id" }>())
}

// lemon-style %fallback: kw is tried as id where the state has no action for kw
type WithFallback = Chain & { Fallback: { kw: "id" } }

{
	type test = Recognize<WithFallback, ["kw", ";"]>
	expectType<test>(toBe<{ ok: true }>())
}
{
	type test = Recognize<Chain, ["kw", ";"]>
	expectType<test>(toBe<{ ok: false; at: 0; token: "kw" }>())
}
