# General Development Findings

**This document contains general development patterns and learnings that apply beyond this specific project.**

Update this when you discover techniques, patterns, or insights that could help with ANY project.

**Part of the 5-document system:**

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings (THIS FILE)
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/YYYY-MM-DD-HHMM-name.md - Current feature plan

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
const _n: never = 1 as unknown as { [K in keyof T]: T[K] }
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
const _n2: never = 1 as unknown as { [K in keyof SqlParserError<"Unknown table">]: SqlParserError<"Unknown table">[K] }
```

After you get the information, remove the debug line.

**Alternative (less reliable):**

```typescript
type _debug = SomeComplexType<Args>
```

This sometimes works but TypeScript may not always show the full resolved type. The `const _n: never` technique is more reliable.

### TypeScript Compile-Time Validation

**Pattern: Use mapped types for compile-time duplicate detection**

When building registries or collections where uniqueness is critical, use TypeScript's type system to enforce it at compile time:

```typescript
// Registry with duplicate detection
export const errors = {
  101: { id: "ERROR_ONE", msg: ["message 1"] },
  102: { id: "ERROR_TWO", msg: ["message 2"] },
} as const

type ErrorsConst = typeof errors

// Detect duplicate IDs
type ErrorIds = { [K in keyof ErrorsConst as ErrorsConst[K]["id"]]: K }

type FoundDuplicateIds = /* complex type checking logic */

type _AssertNoDuplicateIds = ShouldBeFalse<FoundDuplicateIds>
```

**Benefits:**
- Catches duplicates at compile time, not runtime
- No performance overhead
- Impossible to merge code with duplicates
- Self-documenting constraints

**Use cases:**
- Error code registries
- Configuration objects with unique keys
- Enum-like structures
- Any collection requiring uniqueness

**Example from error code implementation:**
- 357 error codes with duplicate ID detection
- Duplicate message detection
- TypeScript compilation fails if duplicates exist
- Zero runtime cost

---

## Workflow Patterns

### Using Subagents Heavily (CRITICAL)

**Why subagents are essential:**

- Main agent's LLM context fills up very quickly
- Subagents provide fresh context for each task
- Parallel execution speeds up work significantly
- Allows main agent to focus on orchestration and decision-making

**Main agent role: Orchestrator, not executor.**

**Pattern for Any Feature:**

1. Launch planning subagent to research and create initial plan
2. Main agent reviews and refines the plan
3. Launch subagent to create first example (establish pattern)
4. Main agent reviews and confirms pattern
5. Launch multiple subagents in parallel for execution
6. Collect workflow feedback from all subagents
7. Main agent consolidates feedback and updates workflow docs
8. Launch review subagent for final quality check

**Pattern for Batch Migrations:**

1. Create one example manually to establish the pattern
2. Launch multiple subagents in parallel for different batches
3. Each subagent gets clear instructions with the reference example
4. Run tests after each batch to catch issues early
5. Fix any issues found and iterate

**Pattern for Large-Scale Registry Additions:**

When adding many items to a registry (e.g., 300+ error codes):

1. **Research phase:** Launch subagent to catalog all items and propose structure
2. **Foundation phase:** Manually implement 10-20% as foundation and pattern
3. **Bulk phase:** Launch subagent to add remaining items following the pattern
4. **Validation phase:** Run full test suite and type checking

**Benefits:**
- Foundation establishes clear pattern for subagent to follow
- Bulk addition via subagent is much faster than manual
- Pattern consistency across all items
- Main context preserved for orchestration

**Example results:**
- Error code implementation: 38 foundation codes (manual), 321 remaining codes (subagent)
- Total time: 19 minutes for 357 codes
- Pattern consistency: 100%
- Tests passing: 2384/2384

**Benefits:**

- Use subagents extensively for batch migrations
- Parallel execution: 4+ subagents processing different file groups simultaneously
- Each subagent handles 5-20 files independently
- Very effective for repetitive transformations
- Preserves main context for high-level coordination

**Example Results:**

- Saved significant time (2 hours vs estimated 6-7 hours)
- Each subagent worked independently on different file groups
- Clear instructions with reference examples led to consistent results

**When to use subagents:**

- **Initial planning and research** - Delegate to subagent, review results
- Repetitive file transformations
- Large-scale refactoring
- Pattern-based code generation
- Exploratory research (reading many files)
- End-of-feature review (mandatory)
- Any task that would consume significant main context
- **Simple repetitive edits across 3+ files** (e.g., path renames, import updates)
- **Threshold rule: 3+ similar edits = use subagent**

**Common mistake: Doing work that should be delegated**

- Example: Creating plan manually instead of delegating to subagent
- Example: Updating path references across 5 files manually
- Example: Reading many files to understand codebase structure
- Should have: Launched subagent with clear task description
- Cost: Wasted main context on work that could be delegated
- Lesson: If you're about to do research or repetitive work, stop and delegate

**Workflow feedback from subagents:**

- Every subagent should return workflow feedback at the end
- Feedback doesn't need to be well-formed - just notes
- Main agent (or another subagent) consolidates all feedback
- Use feedback to improve workflow docs continuously
- Questions for subagents: What worked? What was unclear? What could be improved?

**Avoiding subagent conflicts:**

- **Strategy 1:** Partition by file groups (each subagent gets separate files)
- **Strategy 2:** Partition by document updates (only one entity per document)
- **Strategy 3:** Sequential phases (planning → implementation → documentation → review)
- **Recommended:** Strategy 3 is safest and most efficient

**Workflow feedback collection:**

- Main agent launches subagents with instruction to return workflow feedback
- Subagents MUST provide detailed notes on what worked, what was unclear
- Subagents do NOT update workflow docs directly (avoids conflicts)
- Subagents MAY update feature plan with their progress
- Main agent collects feedback from all subagents as they complete
- Main agent consolidates all feedback and updates all 4 workflow documents
- Consolidated feedback ensures consistency and avoids duplicates
- Creates continuous improvement loop

**Why subagents don't update workflow docs directly:**

- Avoids conflicts when multiple subagents work in parallel
- Ensures consistent voice and organization
- Allows main agent to deduplicate and categorize properly
- Main agent can consolidate similar feedback from multiple subagents
- Easier to review all changes in one place

**End-of-feature review with subagent:**

- Always use a dedicated subagent for final review
- Subagent reviews all 4 workflow documents
- Reports findings back to main agent
- Main agent makes corrections
- Saves critical main context for PR creation

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

2. **Use subagents heavily for all tasks**
    - Delegate planning and research to subagents
    - Launch multiple in parallel for different batches
    - Provide clear instructions with reference examples
    - Let them handle work while you orchestrate
    - Always use a subagent for end-of-feature review
    - Preserve main context by delegating early and often
    - Main agent role: orchestrator, not executor

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

6. **Context management is critical**
    - Main agent context fills up fast
    - Delegate to subagents early, not when context is already full
    - Use subagents for exploration and research
    - Keep main context for orchestration and decision-making
    - End-of-feature review must use a subagent

7. **Context-specific error messages are better**
    - "Unknown table in DELETE FROM" vs generic "Unknown table"
    - Helps users understand where the error occurred
    - Worth the extra complexity

---

## TypeScript for Automation

### Long-Running Monitoring Processes

**Pattern: Use TypeScript for complex monitoring and automation**

- **Classes for state management:** `ImplementationQueue`, `PollingMonitor`, `WebhookMonitor`
- **setInterval for polling loops:** Clean, readable polling logic
- **spawn() with detached: true:** Background processes that survive parent exit
- **Graceful shutdown:** Handle SIGINT/SIGTERM for clean termination
- **Better than bash for:** Complex state, error handling, type safety

**Example use case:**

- GitHub label monitoring with queue and concurrency control
- TypeScript provides better structure than bash for this complexity

### Queue Pattern with Concurrency Control

**Pattern: Manage concurrent operations with a queue**

```typescript
class Queue {
	private queue: Item[] = []
	private processing = new Set<number>()
	private maxConcurrent: number

	async canStart(): Promise<boolean> {
		return this.processing.size < this.maxConcurrent
	}

	enqueue(item: Item): void {
		if (!this.queue.find(i => i.id === item.id)) {
			this.queue.push(item)
		}
	}

	async processQueue(): Promise<void> {
		while (this.queue.length > 0 && (await this.canStart())) {
			const item = this.dequeue()
			if (item) await this.startProcessing(item)
		}
	}
}
```

**Benefits:**

- Prevents overwhelming system resources
- Tracks in-progress items with Set
- Automatically processes next item when slot available
- Clean separation of queue logic from business logic

### GitHub CLI Integration from TypeScript

**Pattern: Wrap `gh` commands with spawn()**

```typescript
async function execGh(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn("gh", args, { stdio: ["ignore", "pipe", "pipe"] })
		let stdout = ""
		proc.stdout.on("data", data => {
			stdout += data.toString()
		})
		proc.on("close", code => {
			if (code === 0) resolve(stdout)
			else reject(new Error(`gh command failed (exit ${code})`))
		})
	})
}
```

**Benefits:**

- Better error handling than bash
- Type-safe result handling with JSON.parse()
- Easier to test and maintain
- Can leverage existing `gh` CLI without API libraries

### Dual-Mode Architecture

**Pattern: Support multiple modes with shared core logic**

- Share common queue and lock file logic
- Different monitors for different modes (polling vs webhook)
- CLI flag to switch modes
- Allows flexibility for different deployment scenarios

**Example:**

- Polling mode: Simple, no infrastructure needed
- Webhook mode: Real-time, requires smee.io or webhook server
- Both use same queue and implementation logic

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
- Use the 5-document system: README, findings, project_knowledge, feature_template, current feature
- Always use a review subagent at the end to ensure quality

### Context Management

- Delegate to subagents early and often
- Don't wait until main context is full
- Use subagents for exploration, batch work, and reviews
- Keep main context for orchestration and high-level decisions
- Launch multiple subagents in parallel when tasks are independent
- Use sequential phases to avoid conflicts between subagents
- **Threshold rule: 3+ similar edits = use subagent immediately**
- Stop and reflect: "Should this be delegated?" before starting any work
- **Delegate planning and research** - Don't do it yourself
- **Collect workflow feedback from all subagents** - Use it to improve workflow
- Main agent consolidates feedback, doesn't execute tasks

### Workflow Retrospection

- After completing work, analyze your own workflow adherence
- **CRITICAL:** Ask: "Did I create feature plan BEFORE starting implementation?"
- **CRITICAL:** Ask: "Did I add 'READ .workflow/ first' directive to feature plan?"
- Ask: "Did I use subagents appropriately?"
- Ask: "Did I act as orchestrator or executor?"
- Ask: "Did I collect workflow feedback from subagents?"
- Ask: "Did I follow the 5-document system correctly?"
- Ask: "What was unclear in the workflow docs that caused deviation?"
- Ask: "Did I update checkboxes during work, not just at end?"
- Ask: "Did I complete the retrospective section?"
- If you deviated from creating feature plan first, what would have prevented it?
- Immediately update workflow docs based on retrospective findings
- Each feature should improve the workflow for the next one
- Self-reflection creates a self-improving system
