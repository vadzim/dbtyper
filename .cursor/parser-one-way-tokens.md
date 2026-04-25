# One-way token parsing (no re-parse)

**Target:** the same text should exist as [rules/parser-one-way-tokens.mdc](rules/parser-one-way-tokens.mdc) (`.mdc` is blocked from Plan mode; add or copy this file in Agent mode).

**Globs (for the .mdc):** `src/parser/**/*.ts`, `core/sql-tokens.ts`

1. **Single forward pass.** Parsers take a `TokensList` and move the cursor only forward via `SkipToken` / helpers that return the **next** `Rest` buffer. Do not implement a design where tokens are first **accumulated** (e.g. into a tail tuple, string, or synthetic buffer) and then **fed again** to `ParseSqlTokens` or a second `Parse*` entry point on that span as if it were new input.

2. **Fail early.** Return `SqlParserError<...>` as soon as a rule does not match; do not "finish collecting" a large region and only then validate structure in a second phase on a copied buffer.

3. **Relationship to [rules/skip-token-once.mdc](rules/skip-token-once.mdc).** That rule governs `SkipToken` cost and threading `rest`. This document forbids **architectural** two-pass parse-the-same-bytes; together they require one logical parse chain and no duplicate lex of the same prefix.

4. **Skipping to a terminator** (e.g. end of `SELECT` tail, or nested subselect end): use [src/parser/skip-statement.ts](src/parser/skip-statement.ts) `SkipStatement<Tokens, EndToken>` with an explicit `EndToken` type (use a **union** such as `TokenKey<";"> | TokenKey<")">` when the tail may end with either). Do not re-tokenize the skipped run.
