import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { ExprParseEnv } from "./parse-expression-ast.ts"
import type { ParseOrScalarUntyped as ParseOrImpl } from "./parse-expression-bool.ts"
import type { ParseOtherOpScalarUntyped as ParseOtherOpImpl } from "./parse-expression-arith.ts"

/** Scalar expression parser: the entry file. The grammar lives in the `parse-expression-*.ts` files (see ARCHITECTURE.md). */
export type {
	ExpressionParamsShape,
	EmptyExpressionParams,
	ExprParseEnv,
	ScalarIdentParts,
	ScalarCmpOp,
	ScalarExprAst,
	EnumBetweenCheck,
} from "./parse-expression-ast.ts"
export type { SingleProjectionColumn } from "./parse-expression-cast.ts"

export type ParseExpressionAST<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOrImpl<Tokens, Env>

/** Aliases, not re-exports: the monad check does not follow a re-export. */
export type ParseOrScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOrImpl<Tokens, Env>
export type ParseOtherOpScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> = ParseOtherOpImpl<
	Tokens,
	Env
>
