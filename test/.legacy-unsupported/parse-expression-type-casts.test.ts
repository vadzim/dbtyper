import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../../src/core/jsql-shapes.ts"
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import type {
	EmptyExpressionParams,
	ParseExpressionAST,
	ResolveExpressionAST,
} from "../../src/parser/parse-expression.ts"
import type { TText, TUuid, TTimestamptz, TBytea, TInet } from "../test-utils/sql-type-helpers.ts"

type DbEmpty = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

type TestEnvForExprParse = {
	db: DbEmpty
	params: EmptyExpressionParams
	outerScope: {}
}

// Test basic type casts
type TCastIntToTextAst = ParseExpressionAST<CreateParserMonad<`123::text`>, TestEnvForExprParse>
type TCastIntToText = ResolveExpressionAST<
	TCastIntToTextAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastIntToTextOk = Expect<Matches<TCastIntToText, TText>>

type TCastTextToUuidAst = ParseExpressionAST<
	CreateParserMonad<`'550e8400-e29b-41d4-a716-446655440000'::uuid`>,
	TestEnvForExprParse
>
type TCastTextToUuid = ResolveExpressionAST<
	TCastTextToUuidAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToUuidOk = Expect<Matches<TCastTextToUuid, TUuid>>

// Test PostgreSQL-specific type casts
type TCastTextToTimestamptzAst = ParseExpressionAST<CreateParserMonad<`'2024-01-01'::timestamptz`>, TestEnvForExprParse>
type TCastTextToTimestamptz = ResolveExpressionAST<
	TCastTextToTimestamptzAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToTimestamptzOk = Expect<Matches<TCastTextToTimestamptz, TTimestamptz>>

type TCastTextToByteaAst = ParseExpressionAST<CreateParserMonad<`'data'::bytea`>, TestEnvForExprParse>
type TCastTextToBytea = ResolveExpressionAST<
	TCastTextToByteaAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToByteaOk = Expect<Matches<TCastTextToBytea, TBytea>>

type TCastTextToInetAst = ParseExpressionAST<CreateParserMonad<`'192.168.1.1'::inet`>, TestEnvForExprParse>
type TCastTextToInet = ResolveExpressionAST<
	TCastTextToInetAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToInetOk = Expect<Matches<TCastTextToInet, TInet>>

// Test invalid casts
type TCastIntToBoolAst = ParseExpressionAST<CreateParserMonad<`123::boolean`>, TestEnvForExprParse>
type TCastIntToBool = ResolveExpressionAST<
	TCastIntToBoolAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastIntToBool = Expect<Matches<TCastIntToBool, { __sql_parser_error__: string }>>

// Test chained casts
type TCastChainedAst = ParseExpressionAST<CreateParserMonad<`123::text::uuid`>, TestEnvForExprParse>
type TCastChained = ResolveExpressionAST<
	TCastChainedAst extends [infer _R, infer Ast, infer _Env] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastChainedOk = Expect<Matches<TCastChained, TUuid>>

describe("parse-expression-type-casts (type tests)", () => {
	it("compile-time assertions above", () => {})
})
