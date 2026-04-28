/**
 * Third slot of intermediate `[Tokens, Mid, Third]` when `Mid` is already `SqlParserError<...>`.
 * Using `never` there poisoned `HasNeverDeep` / tuple projections in tests under strict checking.
 */
export type ParserRefErrorThirdSentinel = { readonly __parserRefErrorThirdSentinel: true }
