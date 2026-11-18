import type { Parse, I } from "./parser.ts"
import type { Shifts, Reductions, Gotos, Rules } from "./gram.ts"

type Tokens = [
	["select", "select"],
	["iconst", "42"],
	["+", "+"],
	["iconst", "43"],
	["*", "*"],
	["(", "("],
	["iconst", "44"],
	["+", "+"],
	["ident", "t"],
	[".", "."],
	["ident", "a"],
	[")", ")"],
	["as", "as"],
	["ident", "b"],
	["from", "from"],
	["ident", "t"],
]

interface Engine {
	args: unknown
	opt_all_clause: this["args"] extends [] ? {} : null
	// Iconst: this["args"] extends [`${infer Ret extends number}`] ? this["args"] : null
	Iconst: this["args"]
}

type x1 = Parse<Engine, [["select", "select"], ["iconst", "42"]]>
// type x2 = Parse<Calls, Tokens>
