/**
 * Third slot of intermediate `[Tokens, Mid, Third]` when `Mid` is already an error type.
 * Using `never` there poisoned `HasNeverDeep` / tuple projections in tests under strict checking.
 */
export type ParserRefErrorThirdSentinel = { readonly __parserRefErrorThirdSentinel: true }
