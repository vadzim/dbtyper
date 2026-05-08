# [Feature/Refactoring Name] Status

**Date:** YYYY-MM-DD HH:MM  
**Current State:** [Brief description of current state]

---

## Overview

[Brief description of what this refactoring/feature is about and why it's needed]

---

## Migration Status

### ✅ Completed (Working)

1. **[Component/Area Name]** (`path/to/file.ts`)
    - [What was done]
    - [What was done]
    - [What was done]

2. **[Component/Area Name]** (`path/to/file.ts`)
    - [What was done]
    - [What was done]

### ❌ Incomplete (Causing Failures)

1. **[Component/Area Name]** (`path/to/file.ts`)
    - **Problem:** [Description of the problem]
    - **Impact:** [How this affects the system]
    - **Proper fix needed:** [What needs to be done]

2. **[Component/Area Name]** (`path/to/file.ts`)
    - **Problem:** [Description of the problem]
    - **Impact:** [How this affects the system]

---

## Current Test Failures

**Total errors:** [Number] TypeScript compilation errors

**Main error patterns:**

1. **[Error Category]:**

    ```
    [Example error message]
    ```

    - Cause: [Why this error occurs]

2. **[Error Category]:**

    ```
    [Example error message]
    ```

    - Cause: [Why this error occurs]

---

## What Needs to Be Done

### Priority 1: [Task Name]

**Goal:** [What this task aims to achieve]

**Files to update:**

- `path/to/file.ts` (main work)
    - [Specific change needed]
    - [Specific change needed]
    - [Specific change needed]

**Approach:**

1. [Step 1]
2. [Step 2]
3. [Step 3]

**Estimated effort:** [Time estimate]

### Priority 2: [Task Name]

**Goal:** [What this task aims to achieve]

**Why this is important:**

- [Reason 1]
- [Reason 2]
- [Reason 3]

**Files to update:**

- `path/to/file.ts`
    - [Specific change needed]

**Estimated effort:** [Time estimate]

### Priority 3: [Task Name]

**Goal:** [What this task aims to achieve]

**Files to update:**

- `path/to/file.ts`
    - [Specific change needed]

**Estimated effort:** [Time estimate]

---

## Migration Strategy

### Recommended Approach: [Approach Name]

1. **Phase 1: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

2. **Phase 2: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

3. **Phase 3: [Phase Name]**
    - [What to do in this phase]
    - [What to do in this phase]

### Alternative Approach: [Approach Name]

1. **[Alternative approach description]**
    - Higher risk of [risk]
    - Faster if successful
    - Harder to debug if issues arise

**Recommendation:** [Which approach to use and why]

---

## Technical Challenges

### Challenge 1: [Challenge Name]

**Problem:** [Description of the challenge]

**Solution:**

- [Solution approach 1]
- [Solution approach 2]
- [Solution approach 3]

### Challenge 2: [Challenge Name]

**Problem:** [Description of the challenge]

**Current state:** [How it's currently handled]

**Future state:** [How it should be handled after migration]

---

## Testing Strategy

1. **Unit tests:** [What to test at unit level]
2. **Integration tests:** [What to test at integration level]
3. **Regression tests:** [What to verify hasn't broken]
4. **Type tests:** [What to verify about type inference]

---

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Criterion 4]
- [ ] [Criterion 5]

---

## Timeline Estimate

- **Priority 1:** [Time estimate] ([description])
- **Priority 2:** [Time estimate] ([description])
- **Priority 3:** [Time estimate] ([description])
- **Priority 4:** [Time estimate] ([description])

**Total:** [Total time estimate] of focused work

---

## Notes

- [Important note 1]
- [Important note 2]
- [Important note 3]

---

## Current Workarounds (Temporary)

These are temporary bridges that should be removed once migration is complete:

1. **[Workaround Name]** in `path/to/file.ts`
    - [What it does]
    - [Why it's needed]
    - **Remove after:** [When to remove it]

2. **[Workaround Name]** in `path/to/file.ts`
    - [What it does]
    - [Why it's needed]
    - **Remove after:** [When to remove it]

---

## Related Files

- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]
- `path/to/file3.ts` - [Description]

---

## Detailed TODO Checklist

### Working Rules

**IMPORTANT:** When working on this migration, follow these rules:

1. **Update checkboxes immediately** - Mark `[x]` as soon as a task is completed
2. **Update the plan as you learn** - If you discover new requirements or issues, add them to the plan
3. **Document blockers** - If stuck, add a note explaining what's blocking progress
4. **Keep progress tracking current** - Update the "Last Updated" timestamp and current phase
5. **Make plan resumable** - Any time you stop work, the plan should be clear enough to resume from where you left off
6. **Commit frequently** - Commit the updated plan document after completing each major step
7. **Run `npm test` frequently** - Run tests after completing each significant change or step to catch issues early
8. **Update knowledge documents** - When you discover something that applies beyond this feature:
   - Project-specific → Update `docs/workflow/knowledge.md`
   - General patterns → Update `docs/workflow/findings.md`

This ensures the plan is always up-to-date and can be resumed at any time.

---

### Phase 1: [Phase Name] (Priority 1)

**Goal:** [What this phase aims to achieve]

#### Step 1.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]
- [ ] [Task 4]

**Notes:** [Any important notes about this step]

#### Step 1.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

#### Step 1.3: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]
- [ ] Test: [What to test]

### Phase 2: [Phase Name] (Priority 2)

**Goal:** [What this phase aims to achieve]

#### Step 2.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

#### Step 2.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

### Phase 3: [Phase Name] (Priority 3)

**Goal:** [What this phase aims to achieve]

#### Step 3.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 3.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] Test: [What to test]

### Phase 4: [Phase Name] (Priority 4)

**Goal:** [What this phase aims to achieve]

#### Step 4.1: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 4.2: [Step Name]

- [ ] [Task 1]
- [ ] [Task 2]

#### Step 4.3: Run Full Test Suite

- [ ] Run `npm test` - should pass all tests
- [ ] Fix any remaining test failures
- [ ] Verify 0 TypeScript compilation errors

### Phase 5: Cleanup and Documentation (Final)

#### Step 5.1: Remove Temporary Code

- [ ] Remove all `// TODO: remove after migration` comments
- [ ] Remove any other temporary workarounds
- [ ] Clean up any dead code

#### Step 5.2: Update Documentation

- [ ] Update `SUPPORTED-SQL.md` if needed
- [ ] Update `README.md` if needed
- [ ] Add entry to `LOG.md` documenting the migration
- [ ] Mark this TODO document as complete

#### Step 5.3: Performance Check

- [ ] Measure TypeScript compilation time before/after
- [ ] Verify no significant performance regression
- [ ] If performance issues, optimize type nesting

#### Step 5.4: Final Verification

- [ ] Run `npm test` - all tests pass
- [ ] Run `npx tsc --noEmit` - 0 errors
- [ ] Run `npm run format:check` - no formatting issues
- [ ] Review git diff - changes look correct

#### Step 5.5: Commit and Document

- [ ] Commit all changes with clear commit message
- [ ] Update this status document with completion date
- [ ] Archive or mark as complete

---

## Progress Tracking

**Started:** YYYY-MM-DD  
**Last Updated:** YYYY-MM-DD HH:MM  
**Status:** [🔄 In Progress | ✅ Completed | ⚠️ Blocked]

**Completed Steps:**

- ✅ [Step description] (completed YYYY-MM-DD HH:MM)
- ✅ [Step description] (completed YYYY-MM-DD HH:MM)
- ✅ [Step description] (completed YYYY-MM-DD HH:MM)

**Current Status:**

- ✅ [Achievement 1]
- ✅ [Achievement 2]
- ⚠️ [Issue or blocker]

**What Was Done ([Date] [Time] - [Time]):**

1. [Change 1]
2. [Change 2]
3. [Change 3]

**Remaining Issues:**

1. **[Issue category] ([number] errors):**
    - [Specific issue 1]
    - [Specific issue 2]

**Root Cause Analysis:**
[Analysis of what's causing the remaining issues]

**Next Steps:**

1. [Next step 1] (highest priority)
2. [Next step 2]
3. [Next step 3]

**Summary:**
[Brief summary of current state and what's been accomplished]

---

## Migration Completion Summary

**Completion Date:** YYYY-MM-DD HH:MM  
**Total Time:** [Duration]

### What Was Accomplished

[High-level summary of what was achieved]

### Key Changes Made

1. **[Change category]** (file paths):
    - [Specific change 1]
    - [Specific change 2]
    - [Impact of changes]

2. **[Change category]** (file paths):
    - [Specific change 1]
    - [Specific change 2]
    - [Impact of changes]

### Test Results

- **Total tests:** [Number]
- **Passing:** [Number] ([Percentage]%)
- **Failing:** [Number]
- **TypeScript errors:** [Number]
- **Monadcheck errors:** [Number]

### Benefits Achieved

1. **[Benefit 1]:** [Description]
2. **[Benefit 2]:** [Description]
3. **[Benefit 3]:** [Description]
4. **[Benefit 4]:** [Description]
5. **[Benefit 5]:** [Description]

### Files Modified

- `path/to/file1.ts` - [What was changed]
- `path/to/file2.ts` - [What was changed]
- `path/to/file3.ts` - [What was changed]

### Migration Complete ✅

All success criteria met:

- ✅ [Criterion 1]
- ✅ [Criterion 2]
- ✅ [Criterion 3]
- ✅ [Criterion 4]
- ✅ [Criterion 5]

### Learnings Added to Knowledge Base

**Remember: You should have already updated the knowledge documents during feature work!**

If you haven't yet, add learnings now:
- Project-specific learnings → `docs/workflow/knowledge.md`
- General patterns/techniques → `docs/workflow/findings.md`
