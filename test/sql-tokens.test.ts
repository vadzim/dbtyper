import type { TokenKey, TokenNumber, TokenParam, TokenString } from "../src/lexer/sql-lexer.ts"
import type { CreateParserMonad, PeekToken } from "../src/lexer/parser-monad.ts"
import type { TestTokensL } from "./test-utils/lexer-test-utils.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

{
	// multi-line comment with overlapped /*/
	type test = PeekToken<CreateParserMonad<`/* uj /*/*/ */*/is */select 1`>>
	type _expect = Expect<Matches<test, TokenKey<"select">>>
}

{
	// single quoted string
	type test = PeekToken<CreateParserMonad<`'foo''bar'\n'baz\n'`>>
	type _expect = Expect<Matches<test, TokenString<"foo'barbaz\n">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.1e56,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123.1e56">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e3,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123.e3">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123.">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e+1,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123.e+1">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e-1,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123.e-1">>>
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`   123,`>>
	type _expect = Expect<Matches<test, TokenNumber<"123">>>
}

{
	// tagged string
	type test = PeekToken<CreateParserMonad<` $$foo$$`>>
	type _expect = Expect<Matches<test, TokenString<"foo">>>
}

{
	// tagged string
	type test = PeekToken<CreateParserMonad<` $ab$foo$ab$`>>
	type _expect = Expect<Matches<test, TokenString<"foo">>>
}

{
	// many spaces
	type Sp1 = "\n\n\n\n\n\n\n\n\n\n"
	type Sp2 = `${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}`
	type Sp3 = `${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}`
	type Sp4 = `${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}`
	type test = PeekToken<CreateParserMonad<`${Sp4} select 1`>>
	type _expect = Expect<Matches<test, TokenKey<"select">>>
}

{
	// operators
	type test = TestTokensL<CreateParserMonad<`+/++.-/-.+#++.@@-@--^^^\n////****///`>>[1]
	type _expect = Expect<
		Matches<
			test,
			[
				TokenKey<"+/">,
				TokenKey<"+">,
				TokenKey<"+">,
				TokenKey<".">,
				TokenKey<"-/">,
				TokenKey<"-">,
				TokenKey<".">,
				TokenKey<"+#++">,
				TokenKey<".">,
				TokenKey<"@@-@">,
				TokenKey<"///">,
				TokenKey<"//">,
			]
		>
	>
}

{
	// parameters
	type test = TestTokensL<CreateParserMonad<`select :1, ?`>>[1]
	type _expect = Expect<
		Matches<
			test,
			[
				//
				TokenKey<"select">,
				TokenParam<"1">,
				TokenKey<",">,
				TokenKey<"?">,
			]
		>
	>
}
