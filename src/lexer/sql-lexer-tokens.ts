import type { DbtyperErrorShape } from "../dbtyper-error.ts"

export type TokenKind = "ident" | "string" | "int" | "float" | "key" | "param" | "indexed_param" | "eot"

export type TokenType<Kind extends TokenKind, Value extends string = ""> = { value: Value; kind: Kind }

export type TokenKey<Key extends string> = TokenType<"key", Key>
export type TokenIdent<Ident extends string> = TokenType<"ident", Ident>
export type TokenString<String extends string> = TokenType<"string", String>
export type TokenInteger<Num extends string> = TokenType<"int", Num>
export type TokenFloat<Num extends string> = TokenType<"float", Num>
export type TokenNumber<Num extends string> = TokenInteger<Num> | TokenFloat<Num>
export type TokenParam<Param extends string> = TokenType<"param", Param>
export type TokenIndexedParam<Index extends string> = TokenType<"indexed_param", Index>
export type TokenEot = TokenType<"eot">

export type TokenStreamHead = TokenType<TokenKind, string> | DbtyperErrorShape

export type Return<Result, Rest> = [Result, Rest]
