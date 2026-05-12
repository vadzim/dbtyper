# Positional Parameters Implementation Plan

## ⚠️ IMPORTANT: This is a Massive Refactor

**This implementation requires a fundamental architectural change to the type-level parser.**

- **Scope:** ~50+ expression parser types need to be updated
- **Impact:** Hundreds of type definitions across 10-15 files
- **Estimated Effort:** 6-10 hours of systematic refactoring
- **Why Necessary:** The current parser architecture doesn't support threading state through expression parsing. This is not a limitation that can be worked around - it requires changing the core return type of expression parsers from `[Tokens, AST]` to `[Tokens, AST, UpdatedEnv]`.

**This refactor is intentional and necessary.** There is no simpler alternative that would correctly handle multiple positional parameters in a single query.

## ✅ IMPLEMENTATION STATUS: ~95% COMPLETE

### Completed Phases:

**Phase 1 - Infrastructure (✅ DONE)**
- Created `ParserState` type with `positionalParamIndex` tracking
- Updated AST to include `index` field for positional-param
- Updated `LookupPositionalParam` to use specific index instead of union
- Added `POSITIONAL_PARAMETER_OUT_OF_BOUNDS` error code
- Added `positionalParamIndex` to `ExprParseEnv`
- Fixed all `ExprParseEnv` construction sites
- Added runtime binding for positional params

**Phase 2 - Expression Parser Updates (✅ DONE)**
Updated ~45+ expression parser types to return `[Tokens, AST, Env]`:
- All literal parsers (true, false, null, string, number, params)
- Positional param parser returns incremented environment
- Array constructor and array indexing
- Unary operators, arithmetic operators, comparison operators
- Boolean operators (NOT, AND, OR)
- Special operators (IS NULL, IN, BETWEEN, LIKE, ANY/ALL/SOME)
- Custom operators
- Function argument parsing
- Parenthesized expressions and subqueries

**Phase 3 - Statement Parser Updates (✅ DONE)**
- SELECT list parsing threads positionalParamIndex through items
- INSERT VALUES parsing threads positionalParamIndex through values
- UPDATE SET parsing threads positionalParamIndex through assignments

**Phase 4 - Cleanup (🔄 IN PROGRESS)**
- Updating remaining callers to handle new 3-tuple return type
- ParseWhereExpression ✅
- ParseOrderByScalarExpr ✅
- ParseGroupByTermsAcc ✅
- ParseInsertOnConflictDoUpdate (in progress)

### Remaining Work (~5%):

1. **Fix remaining ParseExpressionAST call sites** - A few more places need to handle the 3-tuple
2. **Update window clause parsers** (optional, lower priority)
3. **Update CASE/CAST parsers** (optional, lower priority)
4. **Final testing** - Verify `SELECT ?, ?` gives indices 0 and 1

## Goal
Implement parsing "?" as positional parameters in SQL queries, allowing users to pass parameters as an array instead of only as a record/object.

## Current State - FINDINGS ✓
- Currently uses `:name` syntax for named parameters (e.g., `:userId`)
- Parameters are passed as `Record<string, unknown>` at runtime
- Type-level parser in `src/lexer/sql-tokens.ts` tokenizes parameters
- Runtime conversion in `src/postgres/bind-colon-named-params-for-pg.ts` converts `:name` to `$1, $2, ...`
- Main query interface in `src/core/sql-database.ts` with `query<Stmt>(statement, params?)`

### Key Files Identified:
1. **Lexer:** `src/lexer/sql-tokens.ts` - Tokenizes SQL, handles `TokenParam<Param>` for `:name`
2. **Expression Parser:** `src/parser/parse-expression.ts` - Parses params into AST, resolves types
3. **Runtime Binding:** `src/postgres/bind-colon-named-params-for-pg.ts` - Converts named to positional
4. **Database Interface:** `src/core/sql-database.ts` - Main query API
5. **Type Inference:** `src/core/infer-param-types.ts` - Maps runtime values to SQL types

## Key Architectural Discovery

**Current Architecture:**
- Parsers take `Db` as a type parameter (e.g., `ParseSelect<Tokens, Db, Params>`)
- `Db` is actually **state** that gets threaded through parsing
- Expression parser uses `Env` which bundles `{ db, params, outerScope }`
- Resolution phase extracts these as separate parameters

**The Solution:**
Replace `Db` parameter with `State` parameter throughout all parsers:
```typescript
// OLD: Db is passed separately
ParseSelect<Tokens, Db, Params>

// NEW: State bundles db and positionalParamIndex
ParseSelect<Tokens, State, Params>

where State = {
  db: JsqlDatabaseShape
  positionalParamIndex: number
}
```

## Implementation Strategy - REVISED

### Phase 1: Define Parser State Type
Create a new `ParserState` type that replaces the standalone `Db` parameter:

```typescript
// In src/parser/parser-state.ts (new file)
export type ParserState = {
  db: JsqlDatabaseShape
  positionalParamIndex: number
}

export type InitialParserState<Db extends JsqlDatabaseShape> = {
  db: Db
  positionalParamIndex: 0
}

export type IncrementPositionalParamIndex<State extends ParserState> = {
  db: State["db"]
  positionalParamIndex: Inc[State["positionalParamIndex"]]
}
```

### Phase 2: Update Expression Parser
**File:** `src/parser/parse-expression.ts`

1. Update `ExprParseEnv` to use `State`:
```typescript
export type ExprParseEnv = {
  state: ParserState  // Instead of db: JsqlDatabaseShape
  params: ExpressionParamsShape
  outerScope: ScopeMap
}
```

2. Update `ParseExpressionAST` to return updated state:
```typescript
// OLD: Returns [Tokens, AST]
export type ParseExpressionAST<Tokens, Env> = [TokensList, ScalarExprAst]

// NEW: Returns [Tokens, AST, UpdatedState]
export type ParseExpressionAST<Tokens, Env> = [TokensList, ScalarExprAst, ParserState]
```

3. Update positional param parsing to use and increment state:
```typescript
: PeekToken<Tokens> extends TokenKey<"?">
  ? SkipToken<Tokens> extends infer Rpp extends TokensList
    ? [
        Rpp, 
        { kind: "positional-param"; index: Env["state"]["positionalParamIndex"] },
        IncrementPositionalParamIndex<Env["state"]>
      ]
    : never
```

4. Thread updated state through all expression parsing functions

### Phase 3: Update All Statement Parsers
Update each parser to use `State` instead of `Db`:

**Files to update:**
- `src/parser/parse-select.ts`
- `src/parser/parse-insert.ts`
- `src/parser/parse-update.ts`
- `src/parser/parse-delete.ts`
- `src/parser/parse-create-table.ts`
- `src/parser/parse-alter-table.ts`
- All other parser files

**Pattern for each file:**
```typescript
// OLD
export type ParseSelect<
  Tokens extends TokensList,
  Db extends JsqlDatabaseShape,
  Params extends ExpressionParamsShape
> = ...

// NEW
export type ParseSelect<
  Tokens extends TokensList,
  State extends ParserState,
  Params extends ExpressionParamsShape
> = ...
```

**Threading state through:**
```typescript
// When calling ParseExpressionAST, pass state and receive updated state
ParseExpressionAST<Tokens, { state: State; params: Params; outerScope: Scope }> extends [
  infer R1 extends TokensList,
  infer Ast,
  infer UpdatedState extends ParserState
]
  ? // Use UpdatedState for next ParseExpressionAST call
    ParseExpressionAST<R2, { state: UpdatedState; params: Params; outerScope: Scope }> extends [
      infer R3 extends TokensList,
      infer Ast2,
      infer UpdatedState2 extends ParserState
    ]
    ? // Continue threading UpdatedState2...
```

### Phase 4: Update Resolution Phase
**File:** `src/parser/parse-expression.ts`

Update `LookupPositionalParam` to use index:
```typescript
type LookupPositionalParam<Params extends ExpressionParamsShape, Index extends number> = 
  Params extends readonly SqlTypeShape[]
    ? Index extends keyof Params
      ? Params[Index]
      : FormatError<"POSITIONAL_PARAMETER_OUT_OF_BOUNDS", [Index]>
    : FormatError<"POSITIONAL_PARAMETER_REQUIRES_ARRAY", []>
```

Update resolution to extract index from AST:
```typescript
"positional-param": Ast extends { kind: "positional-param"; index: infer I extends number }
  ? LookupPositionalParam<Params, I>
  : never
```

### Phase 5: Update Entry Points
**File:** `src/parser/parse-sql-statement.ts`

Update `ParseSqlStatement` to initialize and use state:
```typescript
export type ParseSqlStatement<
  Tokens extends TokensList,
  Db extends JsqlDatabaseShape,
  Params extends ExpressionParamsShape = EmptyExpressionParams
> = ParseSqlStatementWithState<Tokens, InitialParserState<Db>, Params>

type ParseSqlStatementWithState<
  Tokens extends TokensList,
  State extends ParserState,
  Params extends ExpressionParamsShape
> = // Use State instead of Db throughout
```

### Phase 6: Update AST Type
**File:** `src/parser/parse-expression.ts`

Update AST to store index:
```typescript
export type ScalarExprAst =
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "sql_null" }
  | { kind: "string"; value: string }
  | { kind: "number"; raw: string }
  | { kind: "param"; name: string }
  | { kind: "positional-param"; index: number }  // <-- Add index
  | { kind: "col"; parts: ScalarIdentParts }
  // ...
```

## Implementation Steps - REVISED

1. **Create ParserState type** (new file)
   - [ ] Create `src/parser/parser-state.ts`
   - [ ] Define `ParserState`, `InitialParserState`, `IncrementPositionalParamIndex`

2. **Update Expression Parser**
   - [ ] Update `ExprParseEnv` to use `state: ParserState`
   - [ ] Change `ParseExpressionAST` return type to include `UpdatedState`
   - [ ] Update positional param parsing to store index and return updated state
   - [ ] Thread updated state through all expression parsing functions
   - [ ] Update `LookupPositionalParam` to take `Index` parameter
   - [ ] Update resolution to use index from AST

3. **Update All Statement Parsers** (systematic refactor)
   - [ ] `parse-select.ts` - Replace `Db` with `State`, thread state through
   - [ ] `parse-insert.ts` - Replace `Db` with `State`, thread state through
   - [ ] `parse-update.ts` - Replace `Db` with `State`, thread state through
   - [ ] `parse-delete.ts` - Replace `Db` with `State`, thread state through
   - [ ] `parse-where-expression.ts` - Replace `Db` with `State`, thread state through
   - [ ] All other parser files - Replace `Db` with `State`

4. **Update Entry Points**
   - [ ] `parse-sql-statement.ts` - Initialize state with `positionalParamIndex: 0`
   - [ ] Ensure state is properly threaded through statement parsing

5. **Testing**
   - [ ] Test positional parameters with proper index tracking
   - [ ] Test that `SELECT ?, ?` gives index 0 and 1
   - [ ] Test that `INSERT INTO t VALUES (?, ?)` gives index 0 and 1
   - [ ] Test mixed queries with positional params in multiple clauses
   - [ ] Test backward compatibility with named parameters
   - [ ] Ensure all existing tests still pass

## Expected Outcome

After this refactor:
- ✅ Each "?" will have a unique index based on order of appearance
- ✅ `Params[0]`, `Params[1]`, `Params[2]` will be used instead of `Params[number]`
- ✅ Full type safety for positional parameters with tuples
- ✅ INSERT/UPDATE will work correctly with positional parameters
- ✅ No union type limitations

## Estimated Scope

This is a **large refactor** affecting:
- ~10-15 parser files
- Hundreds of type definitions
- All places where `Db` is passed as a parameter

**Recommendation:** Do this refactor incrementally, one parser file at a time, ensuring tests pass after each change.

## 🔧 Type Debugging Trick

When needing to inspect TypeScript types during development, use this trick to force TypeScript to display the actual resolved type in an error message:

```typescript
const i: never = 1 as unknown as YourTypeHere;
```

This will cause a type error that displays the actual type, which is invaluable for debugging complex type-level computations. For example:

```typescript
// To see what ParseExpressionAST returns:
const debug: never = 1 as unknown as ParseExpressionAST<ParseSqlTokens<"SELECT ?">, MyEnv>;
// Error will show: Type '[TokensList, ScalarExprAst, ExprParseEnv]' is not assignable to type 'never'
```

This trick is essential when working with deeply nested conditional types and helps verify that your type transformations are working as expected.
