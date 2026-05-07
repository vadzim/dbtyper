import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { EmptyExpressionParams, ParseExpressionAST, ResolveExpressionAST } from "../src/parser/parse-expression.ts"

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
type TCastIntToTextAst = ParseExpressionAST<ParseSqlTokens<`123::text`>, TestEnvForExprParse>
type TCastIntToText = ResolveExpressionAST<
	TCastIntToTextAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastIntToTextOk = Expect<Extends<TCastIntToText, { ok: true; sql: "text" }>>

type TCastTextToUuidAst = ParseExpressionAST<
	ParseSqlTokens<`'550e8400-e29b-41d4-a716-446655440000'::uuid`>,
	TestEnvForExprParse
>
type TCastTextToUuid = ResolveExpressionAST<
	TCastTextToUuidAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToUuidOk = Expect<Extends<TCastTextToUuid, { ok: true; sql: "uuid" }>>

// Test PostgreSQL-specific type casts
type TCastTextToTimestamptzAst = ParseExpressionAST<ParseSqlTokens<`'2024-01-01'::timestamptz`>, TestEnvForExprParse>
type TCastTextToTimestamptz = ResolveExpressionAST<
	TCastTextToTimestamptzAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToTimestamptzOk = Expect<Extends<TCastTextToTimestamptz, { ok: true; sql: "timestamptz" }>>

type TCastTextToByteaAst = ParseExpressionAST<ParseSqlTokens<`'data'::bytea`>, TestEnvForExprParse>
type TCastTextToBytea = ResolveExpressionAST<
	TCastTextToByteaAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToByteaOk = Expect<Extends<TCastTextToBytea, { ok: true; sql: "bytea" }>>

type TCastTextToInetAst = ParseExpressionAST<ParseSqlTokens<`'192.168.1.1'::inet`>, TestEnvForExprParse>
type TCastTextToInet = ResolveExpressionAST<
	TCastTextToInetAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastTextToInetOk = Expect<Extends<TCastTextToInet, { ok: true; sql: "inet" }>>

// Test invalid casts
type TCastIntToBoolAst = ParseExpressionAST<ParseSqlTokens<`123::boolean`>, TestEnvForExprParse>
type TCastIntToBool = ResolveExpressionAST<
	TCastIntToBoolAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastIntToBool = Expect<Extends<TCastIntToBool, { ok: true; sql: "boolean" }>>

// Test chained casts
type TCastChainedAst = ParseExpressionAST<ParseSqlTokens<`123::text::uuid`>, TestEnvForExprParse>
type TCastChained = ResolveExpressionAST<
	TCastChainedAst extends [infer _R, infer Ast] ? Ast : never,
	DbEmpty,
	{},
	EmptyExpressionParams
>
type _tCastChainedOk = Expect<Extends<TCastChained, { ok: true; sql: "uuid" }>>

describe("parse-expression-type-casts (type tests)", () => {
	it("compile-time assertions above", () => {})
})
