# scripts

- `create-pr.sh`: opens a pull request for the current branch (`npm run pr`).
- `find-unused-exports.ts`: fails on an export used nowhere; the baseline `unused-exports-baseline.json` may only shrink (`npm run find-unused`).
- `gen-param-stress.mjs`: generates `test/stress/params-*.test-d.ts`; edit the generator, never the generated files (`node scripts/gen-param-stress.mjs`).
- `gen-chain-stress.mjs`: generates the long-chain stress tests of #192 (`test/stress/chain-200-applies-60-tables`, `chain-repeated-ddl-*`, `rename-column-mass`); edit the generator, never the generated files (`node scripts/gen-chain-stress.mjs && npx prettier --write test/stress`).
- `test-real-postgres.ts`: runs the tests that need a real PostgreSQL against `DBTYPER_PG_URL`, one database per suite (`npm run test:postgres`; CI runs it against a service container).
- `check-packaging.ts`: checks what `npm pack` would ship: no source maps, no screenshots, every file of the `exports` map present (`npm run check:packaging`, after `npm run build`). `examples/typed-sqlite-node` has no `paths` in its tsconfig, so its typecheck goes through the package name, the exports map and `dist/`.

## Why `npm run monadcheck` turns one rule off

`--off conditional.monadRelatedNeverNotAllowed`: the checker's rule "no `never` in a branch of a monad-related conditional, return an error type instead" flags the parser's many `X extends infer R extends ParserMonad ? … : never` guards (for example `src/parser/parse-alter-table-add-drop.ts`). The `never` there is the unreachable else of an `infer` guard that always matches (the `SkipToken`/`PeekToken` result is always a `ParserMonad`); real failures are already reported through `dbtyper:NNNN` error types. The other rules of the checker stay on. `monadcheck-log` runs the same command and keeps its stderr in `.logs/<timestamp>.monad.log` (not written when `MI` or `CI` is set).
