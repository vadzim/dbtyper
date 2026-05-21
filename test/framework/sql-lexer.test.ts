import type {
	TokenIndexedParam,
	TokenKey,
	TokenFloat,
	TokenInteger,
	TokenParam,
	TokenString,
} from "../../src/lexer/sql-lexer.ts"
import type { CreateParserMonad, PeekToken } from "../../src/lexer/parser-monad.ts"
import type { TestTokensL } from "../test-utils/lexer-test-utils.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

{
	// multi-line comment with overlapped /*/
	type test = PeekToken<CreateParserMonad<`/* uj /*/*/ */*/is */select 1`>>
	expectType<test>(toBe<TokenKey<"select">>())
}

{
	// single quoted string
	type test = PeekToken<CreateParserMonad<`'foo''bar'\n'baz\n'`>>
	expectType<test>(toBe<TokenString<"foo'barbaz\n">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.1e56,`>>
	expectType<test>(toBe<TokenFloat<"123.1e56">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e3,`>>
	expectType<test>(toBe<TokenFloat<"123.e3">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.,`>>
	expectType<test>(toBe<TokenFloat<"123.">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e+1,`>>
	expectType<test>(toBe<TokenFloat<"123.e+1">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`123.e-1,`>>
	expectType<test>(toBe<TokenFloat<"123.e-1">>())
}

{
	// numbers
	type test = PeekToken<CreateParserMonad<`   123,`>>
	expectType<test>(toBe<TokenInteger<"123">>())
}

{
	// param
	type test = PeekToken<CreateParserMonad<`   :abc ok`>>
	expectType<test>(toBe<TokenParam<"abc">>())
}

{
	// indexed param
	type test = PeekToken<CreateParserMonad<`   $4 ok`>>
	expectType<test>(toBe<TokenIndexedParam<"4">>())
}

{
	// tagged string
	type test = PeekToken<CreateParserMonad<` $$foo$$`>>
	expectType<test>(toBe<TokenString<"foo">>())
}

{
	// tagged string
	type test = PeekToken<CreateParserMonad<` $ab$foo$ab$`>>
	expectType<test>(toBe<TokenString<"foo">>())
}

{
	// many spaces
	type Sp1 = "\n\n\n\n\n\n\n\n\n\n"
	type Sp2 = `${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}${Sp1}`
	type Sp3 = `${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}${Sp2}`
	type Sp4 = `${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}${Sp3}`
	type test = PeekToken<CreateParserMonad<`${Sp4} select 1`>>
	expectType<test>(toBe<TokenKey<"select">>())
}

{
	// operators
	type test = TestTokensL<CreateParserMonad<`+/++.-/-.+#++.@@-@--^^^\n////****///`>>[1]
	expectType<test>(
		toBe<
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
		>(),
	)
}

{
	// parameters
	type test = TestTokensL<CreateParserMonad<`select :a, ?`>>[1]
	expectType<test>(
		toBe<
			[
				//
				TokenKey<"select">,
				TokenParam<"a">,
				TokenKey<",">,
				TokenIndexedParam<"1">,
			]
		>(),
	)
}
