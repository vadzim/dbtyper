# General Development Findings

**This document contains general development patterns and learnings that apply beyond this specific project.**

Update this when you discover techniques, patterns, or insights that could help with ANY project.

---

## Debugging Techniques

### TypeScript Type Debugging

When you need to see what a complex type actually resolves to, use this technique:

```typescript
const _n: never = 1 as unknown as SomeComplexType<Args>
```

Then run `npm run typecheck:test` and TypeScript will show you the actual resolved type in the error message:
```
Type 'SomeComplexType<Args>' is not assignable to type 'never'.
  Type 'SqlParserError<"Unknown table in DELETE FROM">' is not assignable to type 'never'.
```

**If TypeScript hides the implementation** (shows type alias instead of expanded type), use this:

```typescript
const _n: never = 1 as unknown as {[K in keyof T]: T[K]}
```

This forces TypeScript to expand and show the full structure of the type, not just its name.

**Why these work:**
- `never` type accepts no values
- TypeScript shows what type you're trying to assign to it
- Forces TypeScript to fully resolve and display the type
- Mapped type `{[K in keyof T]: T[K]}` forces expansion of type aliases

**Example:**
```typescript
// To see what error ExtractQueryError returns:
const _n: never = 1 as unknown as ExtractQueryError<DbShape, typeof query>

// TypeScript error shows:
// Type 'SqlParserError<"Unknown table in DELETE FROM">' is not assignable to type 'never'
// Now you know the exact error message to use in your test

// If you need to see the full structure of SqlParserError:
const _n2: never = 1 as unknown as {[K in keyof SqlParserError<"Unknown table">]: SqlParserError<"Unknown table">[K]}
```

After you get the information, remove the debug line.

**Alternative (less reliable):**
```typescript
type _debug = SomeComplexType<Args>
```
This sometimes works but TypeScript may not always show the full resolved type. The `const _n: never` technique is more reliable.

---

## Workflow Patterns

### Using Subagents for Batch Migrations

**Pattern for Batch Migrations:**
1. Create one example manually to establish the pattern
2. Launch multiple subagents in parallel for different batches
3. Each subagent gets clear instructions with the reference example
4. Run tests after each batch to catch issues early
5. Fix any issues found and iterate

**Benefits:**
- Use subagents extensively for batch migrations
- Parallel execution: 4+ subagents processing different file groups simultaneously
- Each subagent handles 5-20 files independently
- Very effective for repetitive transformations

**Example Results:**
- Saved significant time (2 hours vs estimated 6-7 hours)
- Each subagent worked independently on different file groups
- Clear instructions with reference examples led to consistent results

**When to use:**
- Repetitive file transformations
- Large-scale refactoring
- Pattern-based code generation

---

## Workflow Efficiency

### ✅ What Worked Well

1. **Using subagents for parallel batch processing**
   - Saved significant time (2 hours vs estimated 6-7 hours)
   - Each subagent worked independently on different file groups
   - Clear instructions with reference examples led to consistent results

2. **Infrastructure tests caught inconsistencies immediately**
   - Validation rules enforced the pattern
   - Failed fast when files didn't match expected format

3. **Type system provided instant feedback**
   - Wrong error messages caught at compile time
   - No need to run tests to verify error message correctness

4. **Incremental approach**
   - Started with one example file
   - Validated the approach before scaling
   - Fixed issues early before they multiplied

### ⚠️ Challenges Encountered

1. **Type instantiation depth required fundamental approach change**
   - Initial approach failed completely
   - Needed to investigate and understand the root cause
   - Solution required different mental model (inline shapes vs runtime types)

2. **Error messages weren't always what was expected**
   - Had to investigate actual error strings in parser source
   - Context-specific messages (DELETE vs UPDATE vs INSERT)
   - Required iteration and fixes after initial migration

3. **Infrastructure validation regex needed multiple iterations**
   - Pattern matching for `@ts-expect-error` placement was tricky
   - Had to account for different query call patterns (query/stream/apply)
   - Blank lines and comments caused validation failures

4. **Some files had subtle formatting differences**
   - Blank lines between `@ts-expect-error` and query call
   - Comments in unexpected places
   - Required cleanup pass after initial migration

### 📊 Time Estimate vs Reality

- **Plan estimated:** 6-7 hours
- **Actual:** ~2 hours with heavy subagent usage
- **Key factor:** Subagents handled the tedious repetitive work efficiently

---

## Key Takeaways for Future Work

1. **Always investigate before scaling**
   - Test approach with one example first
   - Understand type system limitations early
   - Don't assume the obvious approach will work

2. **Use subagents for repetitive tasks**
   - Launch multiple in parallel for different batches
   - Provide clear instructions with reference examples
   - Let them handle the tedious work while you orchestrate

3. **Infrastructure tests are invaluable**
   - Enforce patterns automatically
   - Catch inconsistencies immediately
   - Make refactoring safer

4. **Type-level programming requires different thinking**
   - Runtime types ≠ type-level types
   - Avoid deeply nested types in type-level operations
   - Pattern matching often better than indexed access

5. **Document error messages explicitly**
   - Makes them part of the API contract
   - Prevents accidental changes
   - Improves test clarity

6. **Context-specific error messages are better**
   - "Unknown table in DELETE FROM" vs generic "Unknown table"
   - Helps users understand where the error occurred
   - Worth the extra complexity

---

## General Best Practices

### Incremental Development

- Start with one example to validate approach
- Scale only after confirming the pattern works
- Fix issues early before they multiply
- Run tests frequently to catch problems

### Documentation

- Update documentation throughout development, not just at end
- Capture insights while they're fresh
- Separate project-specific from general knowledge
- Review documentation for consistency before completing work

### Optimization

- Could subagent usage be further optimized?
  - More granular batching?
  - Better error recovery?
