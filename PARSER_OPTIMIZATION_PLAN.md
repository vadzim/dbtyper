# Parser Optimization Plan

This document details the three primary architectural improvements that can be made to the `dbtyper` type-level parsers to improve IDE responsiveness (Language Server performance) and avoid the dreaded `Type instantiation is excessively deep and possibly infinite` compiler errors.

## 1. Enforcing Tail-Call Optimization (TCO) on Recursive Parsers

### The Problem

TypeScript 4.5 introduced Tail-Call Optimization for recursive conditional types. This allows recursive types to loop up to 1,000 times instead of the default limit of 50. However, TCO only triggers if the recursive call is the **absolute top-level return value** of the conditional branch.

If a recursive call is wrapped in an `extends` check, tuple `[ ]`, or an `infer` block, TCO is broken, and TypeScript must hold the entire call stack in memory.

### The Solution

Audit all recursive list and token parsers (e.g., `ParseRawSelectList`, `ParseInListUntypedAccum`). Ensure that they strictly pass state via an `Acc` (accumulator) and that the recursive call is never wrapped.

### Example

**Broken TCO (Stack-heavy):**

```typescript
// TCO is broken because the recursive call is wrapped in `extends [infer R, infer E]`
type ParseList<Tokens> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseList<SkipToken<Tokens>> extends [infer Rest, infer Items] // <-- Breaks TCO
			? [Rest, [...Items, NextItem]]
			: never
		: [Tokens, []]
```

**Fixed TCO (Optimized):**

```typescript
// TCO works because `ParseList` is the direct return of the branch
type ParseList<Tokens, Acc extends any[] = []> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseItem<SkipToken<Tokens>> extends [infer Rest, infer Item]
			? ParseList<Rest, [...Acc, Item]> // <-- Direct return, TCO triggers!
			: never
		: [Tokens, Acc]
```

---

## 2. Replacing Recursive Descent with a Flat Expression Parser

### The Problem

Currently, `parse-expression.ts` uses strict Recursive Descent: `ParseOr` calls `ParseAnd`, which calls `ParseNot`, which calls `ParseRel`, which calls `ParseAdd`.
For a simple identifier like `users.id`, the TypeScript compiler has to instantiate 5-6 nested conditional types just to reach the base token. In complex queries with deep nesting, this rapidly exhausts the type instantiation depth limit.

### The Solution

Implement a **Pratt Parser** or **Shunting Yard Algorithm** at the type level. Instead of nesting types by precedence, you use a **single recursive loop** that consumes tokens, checks their precedence via a lookup map, and pushes them onto an `OperatorStack` and `OperandStack` inside its accumulator.

### Example

**Current (Deeply Nested):**

```typescript
type ParseOr<T> = ParseAnd<T> extends ...
type ParseAnd<T> = ParseNot<T> extends ...
type ParseNot<T> = ParseRel<T> extends ...
// Depth increases by 1 for every level of precedence, even if the operator isn't used!
```

**Proposed (Flat Shunting Yard Loop):**

```typescript
type OperatorPrecedence = {
  "or": 1,
  "and": 2,
  "not": 3,
  "eq": 4,
  "add": 5
}

// A single TCO-optimized loop that compares precedence and reduces stacks
type ParseExpressionFlat<Tokens, OpStack extends any[] = [], NodeStack extends any[] = []> =
  PeekToken<Tokens> extends infer Tok
    ? Tok extends TokenKey<infer Op>
      ? /* Compare Precedence(Op) against Top(OpStack) and reduce/push */
        ParseExpressionFlat<SkipToken<Tokens>, [...OpStack, Op], NodeStack>
      : /* It's an operand, push to NodeStack */
        ParseExpressionFlat<SkipToken<Tokens>, OpStack, [...NodeStack, Tok]>
    : /* EOF, reduce remaining stacks */
```

---

## 3. O(1) Indexed Access Dispatcher for AST Resolution

### The Problem

`ResolveExpressionAST` is a massive chain of ternary conditionals:
`Ast extends { kind: 'x' } ? ... : Ast extends { kind: 'y' } ? ...`
TypeScript evaluates these sequentially. If you have 30 AST node kinds, resolving the 30th kind takes 30 sequential conditional evaluations. When a query projects 20 columns, that's 600 evaluations just for the root nodes.

### The Solution

Convert the conditional chain into an **Indexed Access Type** (a type-level registry map). TypeScript evaluates indexed access (`Map[Key]`) in **O(1) time**, which is phenomenally faster and uses almost no instantiation depth.

### Example

**Current (O(N) Sequential Evaluation):**

```typescript
export type ResolveExpressionAST<Ast, Db, Scope> = Ast extends { kind: "true" }
	? ExprOk<true, "boolean">
	: Ast extends { kind: "false" }
		? ExprOk<false, "boolean">
		: Ast extends { kind: "add"; left: infer L; right: infer R }
			? ResolveScalarExprAstPair<L, R, Db, Scope>
			: // ... 25 more conditions ...
				never
```

**Proposed (O(1) Dispatch Evaluation):**

```typescript
// 1. Define a registry map mapping `kind` to the resolved type
type ExpressionResolvers<Ast, Db, Scope> = {
	true: ExprOk<true, "boolean">
	false: ExprOk<false, "boolean">
	add: Ast extends { left: infer L; right: infer R } ? ResolveScalarExprAstPair<L, R, Db, Scope> : never
	sub: Ast extends { left: infer L; right: infer R } ? ResolveScalarExprAstPair<L, R, Db, Scope> : never
	// ... all other kinds ...
}

// 2. Dispatch in O(1) time
export type ResolveExpressionAST<Ast, Db, Scope> = Ast extends {
	kind: infer K extends keyof ExpressionResolvers<any, any, any>
}
	? ExpressionResolvers<Ast, Db, Scope>[K]
	: never
```

This single architectural shift will drastically reduce the time it takes for IDE tooltips to render the inferred return type of a `db.query(...)` call.
