# Development Workflow Guide

## 🔄 The Five-Document System

**When working on ANY feature, you MUST continuously update ALL FIVE DOCUMENTS:**

1. **.workflow/README.md** (this file) - Workflow instructions
2. **.workflow/findings.md** - General development findings
3. **.workflow/project_knowledge.md** - Project-specific knowledge
4. **.workflow/feature_template.md** - Template for new features
5. **.features/YYYY-MM-DD-HHMM-feature-name.md** - Your current feature plan

**Update ALL FIVE documents throughout development, not just at the end!**

---

## 📁 The Five Documents Explained

### 1. .workflow/README.md (this file)

**Purpose:** Workflow instructions and guidelines

**Update when:**

- Workflow process changes
- New best practices for using these documents
- Instructions need clarification

**Contains:**

- How to use the 5-document system
- Decision tree for which document to update
- Workflow guidelines
- Feature complexity classification

---

## 🎯 Feature Complexity Classification

**Before starting work, classify your feature to determine the appropriate workflow level:**

### Simple Features (Streamlined Workflow)

**Characteristics:**
- Single file creation or trivial edit
- No code logic changes
- Documentation-only updates
- Configuration file changes
- Takes < 5 minutes of actual work

**Examples:**
- Creating a welcome.txt file
- Adding a README section
- Updating a configuration value
- Renaming a single file

**Streamlined workflow:**
1. Read workflow documents (still required)
2. Create feature plan (still required - demonstrates workflow adherence)
3. Implement change
4. Run tests
5. Update feature plan with completion
6. Commit and create PR

**Subagents:** Not needed for simple features

### Complex Features (Full Workflow)

**Characteristics:**
- Multi-file changes
- Code refactoring or new functionality
- Requires research or exploration
- Multiple phases or steps
- Takes > 15 minutes of actual work

**Examples:**
- Adding new API endpoints
- Refactoring type system
- Batch migrations across many files
- New feature implementation

**Full workflow:**
1. Read workflow documents
2. Create feature plan BEFORE implementation
3. Launch planning subagent for research
4. Review and refine plan
5. Launch implementation subagents (parallel when possible)
6. Collect workflow feedback from subagents
7. Update all 5 documents continuously
8. Launch review subagent at end
9. Commit and create PR

**Subagents:** Required - use heavily to manage context

### When in Doubt

**If unsure whether a feature is simple or complex:**
- Default to complex workflow (safer)
- If you find yourself doing 3+ similar edits, switch to using subagents
- Always create feature plan BEFORE implementation regardless of complexity

---

### 2. .workflow/findings.md

**Purpose:** General development findings (applicable to ANY project)

**Update when you discover:**

- 🐛 **Debugging techniques** - TypeScript tricks, investigation methods
- ⚡ **Workflow patterns** - What works well (like using subagents)
- 📊 **Efficiency insights** - What worked well, what didn't
- 🎯 **General best practices** - Applicable to any project

**Examples:**

- "TypeScript type debugging: const \_n: never = 1 as unknown as T"
- "Subagents work well for batch migrations (saved 4-5 hours)"
- "Infrastructure tests catch issues early"

---

### 3. .workflow/project_knowledge.md

**Purpose:** Project-specific knowledge (specific to THIS project)

**Update when you discover:**

- 🏗️ **Project conventions** - Patterns that apply to all features
- 🔧 **Tool usage** - Commands, build tools, how things work
- 🧠 **Architecture insights** - How the system is structured
- 💡 **Solutions to common problems** - Pitfalls and how to avoid them
- 📋 **Project-specific conventions** - Naming, structure, rules

**Examples:**

- "Test files must follow {operation}-{scenario}.{success|error}.test.ts naming"
- "This project uses tsgo for faster type checking"
- "SQL parser returns tuples: [NewDbShape, Tokens, Error]"

---

### 4. .workflow/feature_template.md

**Purpose:** Template for creating new feature plans

**Update when:**

- Template structure needs improvement
- New sections should be added to feature plans
- Better examples are discovered

**Use this:**

- Copy this template when starting a new feature
- Save it in `.features/` folder
- Name it: `YYYY-MM-DD-HHMM-feature-name.md`

---

### 5. .features/YYYY-MM-DD-HHMM-feature-name.md (your current feature)

**Purpose:** Track progress for THIS specific feature

**Location:** `.features/` folder

**Create at start:** Use timestamp format `YYYY-MM-DD-HHMM-feature-name.md`

- Example: `.features/2026-05-08-0430-error-message-checking.md`

**CRITICAL: Create this BEFORE any implementation work!**

**Must include at top:**

```markdown
**IMPORTANT: If resuming this feature, READ .workflow/ folder first:**

- .workflow/README.md - Workflow instructions
- .workflow/findings.md - General development patterns
- .workflow/project_knowledge.md - Project-specific knowledge
- .workflow/feature_template.md - Template structure
```

**Update continuously with:**

- ✅ Mark checkboxes as tasks complete
- 📝 Track what you've done in this session
- ⚠️ Document blockers or issues specific to this feature
- 📊 Update progress tracking and next steps
- 🎯 Feature-specific decisions and temporary workarounds

**Update frequency:** After completing each significant step or task

**Purpose:** This document allows you (or another agent) to resume work at any time by reading it

---

## 🤔 Decision Tree: Which Document to Update?

### Question 1: Is this about the workflow process itself?

**YES** → Update **.workflow/README.md**

- Example: "Add new step to workflow"
- Example: "Clarify when to update documents"

**NO** → Go to Question 2

### Question 2: Is this about THIS feature only?

**YES** → Update **your feature plan** (.features/YYYY-MM-DD-HHMM-name.md)

- Example: "Completed migration of 10 INSERT test files"
- Example: "Blocked on understanding error message format"
- Example: "Next: migrate UPDATE test files"

**NO** → Go to Question 3

### Question 3: Is this specific to THIS project?

**YES** → Update **.workflow/project_knowledge.md**

- Example: "Test files must follow {operation}-{scenario}.{success|error}.test.ts naming"
- Example: "This project uses tsgo for faster type checking"
- Example: "SQL parser returns tuples: [NewDbShape, Tokens, Error]"

**NO** → Update **.workflow/findings.md**

- Example: "TypeScript type debugging: const \_n: never = 1 as unknown as T"
- Example: "Subagents work well for batch migrations"
- Example: "Infrastructure tests catch issues early"

### Question 4: Is this about the feature template?

**YES** → Update **.workflow/feature_template.md**

- Example: "Add new section for performance considerations"
- Example: "Improve TODO checklist structure"

---

## 🤖 Using Subagents (CRITICAL for Context Management)

**IMPORTANT:** Your LLM context can overflow very quickly. Use subagents heavily to manage context and parallelize work.

### Why Use Subagents Heavily

1. **Context Management** - Your main context fills up fast. Delegate to subagents to preserve space.
2. **Parallel Execution** - Multiple subagents can work simultaneously on different tasks.
3. **Specialized Focus** - Each subagent has fresh context for its specific task.
4. **Efficiency** - Subagents handle tedious, repetitive work while you orchestrate.

### When to Use Subagents

**Always use subagents for:**
- **Initial planning and strategy** - Delegate research and plan creation
- Batch migrations (multiple files with same pattern)
- Large-scale refactoring across many files
- End-of-feature review (see below)
- Exploratory research that might require many file reads
- Any repetitive task that would consume significant context
- **Simple repetitive edits across 3+ files** (e.g., renaming paths, updating imports)
- **Any task where you'll make 5+ similar edits** (even in same file)

**Do NOT use subagents for:**
- Single file creation (e.g., creating welcome.txt)
- Trivial edits (changing one value)
- Documentation-only updates
- Simple features classified as "simple" (see Feature Complexity Classification above)

**Threshold rule: If you're about to do the same type of edit more than 3 times, use a subagent.**

**Use main context for:**

- Orchestrating subagent work
- Reviewing and refining plans created by subagents
- Making final decisions based on subagent feedback
- Consolidating workflow feedback from subagents
- Final verification and PR creation
- Single-file edits or one-off changes

**Main agent's role: Orchestrator, not executor.**

### The 5-Document System and Subagents

**All subagents MUST be aware of the 5-document system:**

When launching a subagent, include in the prompt:

```
You are working on [feature name]. This project uses a 5-document system:

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/[current-feature].md - Current feature plan

IMPORTANT: Do NOT update the 4 workflow documents (.workflow/*) yourself.
Your job is to provide detailed feedback so the main agent can update them.

You MAY update the feature plan (.features/[current-feature].md) with your progress.

CRITICAL: At the end of your work, you MUST provide workflow feedback.
This is not optional - it's a required part of your task.

Provide detailed workflow feedback covering:
- What worked well in the workflow
- What was unclear or confusing in workflow docs
- What could be improved in workflow docs
- Any deviations you made and why
- Suggestions for workflow doc improvements
- Any threshold rules that should be added or clarified
- Project-specific patterns discovered → for .workflow/project_knowledge.md
- General techniques discovered → for .workflow/findings.md
- Template improvements needed → for .workflow/feature_template.md
- Workflow process improvements → for .workflow/README.md

Be specific and detailed in your feedback. The main agent will use it to update
all 4 workflow documents, so provide enough context and examples.
```

### Avoiding Subagent Conflicts

**Strategy 1: Partition by File Groups**

Assign non-overlapping file sets to each subagent:

```
Subagent 1: Handle files in test/integration/insert/*.error.test.ts
Subagent 2: Handle files in test/integration/update/*.error.test.ts
Subagent 3: Handle files in test/integration/delete/*.error.test.ts
Subagent 4: Handle files in test/integration/select/*.error.test.ts
```

**Strategy 2: Partition by Document Updates**

Only ONE entity updates each document at a time:

```
Main Agent: Updates docs/features/[current-feature].md (progress tracking)
Subagent 1: Collects findings for docs/workflow/findings.md (reports back)
Subagent 2: Collects project knowledge for docs/workflow/project_knowledge.md (reports back)
Main Agent: Consolidates and writes to workflow docs
```

**Strategy 3: Sequential Phases**

Run subagents in phases, not all at once:

```
Phase 1: Subagents 1-4 migrate files (no doc updates, just report findings)
Phase 2: Main agent updates all 5 documents based on reports
Phase 3: Subagent 5 does end-of-feature review
```

**Recommended Approach: Strategy 3 (Sequential Phases)**

This is the safest and most efficient:

1. **Planning Phase:**
    - Launch planning subagent to research and create plan
    - Main agent reviews and refines

2. **Implementation Phase:**
    - Launch multiple subagents in parallel for file work
    - Each subagent works on separate file groups
    - Subagents report findings and MUST provide workflow feedback
    - Main agent collects all feedback as subagents complete

3. **Documentation Phase:**
    - Main agent consolidates all feedback from implementation subagents
    - Main agent updates all 5 documents based on consolidated feedback:
        - .features/[current-feature].md - progress and learnings
        - .workflow/project_knowledge.md - project-specific patterns
        - .workflow/findings.md - general techniques
        - .workflow/feature_template.md - template improvements
        - .workflow/README.md - workflow improvements
    - Main agent reviews workflow docs for consistency

4. **Final Review Phase:**
    - Launch final review subagent to verify all documents
    - Main agent makes any final corrections
    - Create PR

### End-of-Feature Review with Subagent

**CRITICAL:** Use a dedicated subagent for the end-of-feature review to save context.

**Subagent prompt template:**

```
You are performing an end-of-feature review for [feature name].

Your task: Review all 4 workflow documents for consistency, clarity, and quality.

Documents to review:
1. .workflow/README.md
2. .workflow/findings.md
3. .workflow/project_knowledge.md
4. .workflow/feature_template.md

For each document, check:
- Consistency: No contradictions with other docs or within itself
- Clarity: No ambiguities, clear and understandable
- Completeness: Nothing missing, all examples present
- Organization: Content in right sections, logical flow
- Duplicates: No repeated information across documents
- Actualized Knowledge: Reflects reality, not just theory
- Accuracy: Commands, paths, technical details correct

Also review:
5. .features/[current-feature].md - Verify completion summary is accurate

CRITICAL QUESTION: What in the workflow could be done better keeping in mind the current feature development?
- Consider what was unclear during this feature
- Consider what thresholds or rules would have helped
- Consider what examples would have made the workflow clearer
- Consider what caused any deviations from the workflow
- Consider what would make the workflow easier to follow

Report back:
- Issues found (with specific line references)
- Suggestions for improvements
- Answer to the critical question about workflow improvements
- Confirmation when all checks pass

Do NOT make changes yourself - report findings so the main agent can decide.
```

### Subagent Workflow Example

**Good workflow:**

```
Main Agent:
1. Launch planning subagent to research and create feature plan
2. Review plan, provide feedback, refine
3. Create feature plan document in .features/ based on subagent's work
4. Launch subagent to create first example file (establish pattern)
5. Review example, confirm pattern is correct
6. Launch 4 subagents in parallel for batch migration
   - Each gets separate file group
   - Each MUST return workflow feedback at end
7. Collect all workflow feedback as subagents complete
8. Consolidate feedback and update all 5 documents:
   - Identify common themes and patterns
   - Categorize: general vs project-specific
   - Update .features/[feature].md with progress and learnings
   - Update .workflow/project_knowledge.md with project patterns
   - Update .workflow/findings.md with general techniques
   - Update .workflow/feature_template.md if needed
   - Update .workflow/README.md with workflow improvements
9. Review workflow docs for consistency
10. Launch final review subagent to verify all documents
11. Make any final corrections based on review
12. Create PR
```

**Bad workflow (avoid):**

```
Main Agent:
1. Read all files directly (context overflow!)
2. Create plan manually (consuming context)
3. Migrate all files directly (context overflow!)
4. Try to update all docs at end (context overflow!)
5. No review because context is full
6. No workflow feedback collected
7. Workflow doesn't improve
```

**Key principles:**

- Main agent orchestrates, subagents execute
- All subagents MUST provide workflow feedback
- Main agent consolidates feedback and updates all 5 documents
- Workflow continuously improves through feedback loop

---

### Context Management Tips

1. **Delegate early** - Don't wait until context is full
2. **Use subagents for exploration** - Let them read files and report back
3. **Keep main context clean** - Focus on orchestration and decision-making
4. **Batch subagent launches** - Launch multiple in parallel when possible
5. **Workflow feedback is mandatory** - Every subagent must provide it
6. **Main agent consolidates feedback** - Collect from all subagents and update all 5 documents
7. **Delegate planning** - Even initial planning can be delegated to subagents
8. **Review is mandatory** - Always use a subagent for end-of-feature review

---

## 📋 Complete Workflow

### At Start of Feature (CRITICAL - DO THIS FIRST):

**BEFORE doing ANY implementation work:**

1. **Read ALL 4 workflow documents** (`.workflow/*.md`) - Understand the system
2. **Create feature plan IMMEDIATELY:**
    - Copy `.workflow/feature_template.md` to `.features/YYYY-MM-DD-HHMM-feature-name.md`
    - Fill in Overview section with what you understand so far
    - **Add directive at top:** "IMPORTANT: If resuming this feature, READ .workflow/ folder first"
3. **Launch planning subagent** - Research codebase and create detailed plan
4. **Review and refine plan** (main agent) - Provide feedback, make decisions
5. **Update feature plan** with detailed breakdown from subagent research
6. **Plan subagent usage** - Identify which tasks can be delegated to subagents

**The feature plan is your working document - update it continuously as you work!**

### During Feature Work:

**Use subagents heavily to preserve main context:**

1. **Launch subagent for first example** - Establish the pattern
2. **Review example** (main agent) - Confirm pattern is correct
3. **Launch subagents for batch work** (parallel) - Each works on separate file groups
4. **Collect workflow feedback** - Each subagent MUST return workflow feedback
5. **Consolidate feedback** (main agent) - Process all workflow feedback from subagents
6. **Update all 5 documents** (main agent) - Based on consolidated feedback:
    - .features/[feature].md - progress and learnings
    - .workflow/project_knowledge.md - project-specific patterns
    - .workflow/findings.md - general techniques
    - .workflow/feature_template.md - template improvements
    - .workflow/README.md - workflow improvements
7. **Review workflow docs** (main agent) - Check for consistency
8. **Repeat** - Continue delegating to subagents as needed

### At End of Feature:

1. **Launch final review subagent** - Review all 4 workflow documents for consistency, clarity, quality
2. **Make corrections** (main agent) - Based on review subagent's findings
3. **Perform workflow retrospective** - Analyze your own workflow adherence (see below)
4. **Mark feature plan as complete** - Update completion summary
5. **Create PR** - All documents reviewed and consistent

---

## 🔍 Workflow Retrospective (Self-Reflection)

**CRITICAL:** After completing any feature or significant task, perform a retrospective on your own workflow adherence.

### Questions to Ask Yourself

1. **Did I use subagents appropriately?**
    - Did I do repetitive work manually that should have been delegated?
    - Did I consume main context on tasks that could have been subagent work?
    - Did I delegate early enough, or wait until context was already full?
    - Did I delegate planning and research, or do it myself?
    - Did I collect workflow feedback from subagents?

2. **Did I follow the 5-document system?**
    - **CRITICAL:** Did I create the feature plan BEFORE starting ANY implementation?
    - **CRITICAL:** Did I add the "READ .workflow/ first" directive at the top of the feature plan?
    - Did I update all 5 documents continuously, or batch updates at the end?
    - Did I categorize learnings correctly (general vs project-specific)?
    - Did I update the feature plan after each significant step?
    - If I deviated from creating feature plan first, what in the workflow docs was unclear?

3. **What could I have done better?**
    - Where did I deviate from the workflow?
    - What caused the deviation? (unclear rules, habit, oversight?)
    - How can the workflow docs be improved to prevent this?
    - Did I act as orchestrator or executor?

4. **CRITICAL: What in the workflow could be done better keeping in mind the current feature development?**
    - What was unclear during this feature that should be clarified?
    - What thresholds or rules would have helped?
    - What examples would have made the workflow clearer?
    - What caused any deviations from the workflow?
    - What would make the workflow easier to follow for similar features?

### Retrospective Template

After completing work, add a retrospective section to your feature plan:

```markdown
## Workflow Retrospective

**What went well:**

- [What you did correctly according to workflow]

**What could be improved:**

- [Where you deviated from workflow]
- [Why the deviation happened]
- [What was unclear in workflow docs]
- **CRITICAL checks:**
    - Did I create feature plan BEFORE implementation? [Yes/No]
    - Did I add "READ .workflow/ first" directive? [Yes/No]
    - If No to either: What would have prevented this deviation?

**Workflow doc improvements needed:**

- [Specific improvements to prevent future deviations]
- [Clarifications needed]
- [New examples or thresholds to add]
- [What would have prevented this deviation?]
```

### Acting on Retrospective Findings

**If you identify workflow doc improvements:**

1. Immediately update `.workflow/README.md` with clarifications
2. Add examples to `.workflow/findings.md` if generally applicable
3. Update `.workflow/feature_template.md` if template needs changes

**This creates a self-improving system** - each feature makes the workflow clearer for the next one.

---

## 🎯 Why This Matters

- **For you:** Build knowledge that makes future work faster
- **For others:** Share learnings so they don't repeat your work
- **For the project:** Create a living knowledge base that grows over time

**Remember: Update ALL FIVE documents continuously throughout development!**

---

## 📝 End-of-Feature Review Checklist

**CRITICAL:** Before creating PR, you MUST review all 4 workflow documents for consistency, clarity, and quality.

### Review Each Workflow Document

**.workflow/README.md:**

- ✅ **Accuracy** - Are workflow instructions still accurate?
- ✅ **Completeness** - Do any guidelines need updating based on what you learned?
- ✅ **Clarity** - Are instructions clear and unambiguous?
- ✅ **Consistency** - Does it align with how you actually worked?

**.workflow/findings.md:**

- ✅ **Consistency** - Do new sections fit with existing content? No contradictions?
- ✅ **Clarity** - Is new content understandable to others? No ambiguities?
- ✅ **Completeness** - Are there missing explanations or examples?
- ✅ **Organization** - Is content in the right section? Logical flow?
- ✅ **Duplicates** - Did you accidentally add duplicate information?
- ✅ **Actualized Knowledge** - Does it reflect what actually worked, not just theory?
- ✅ **Generalizability** - Are findings truly applicable to ANY project, not just this one?

**.workflow/project_knowledge.md:**

- ✅ **Consistency** - Do new sections fit with existing content? No contradictions?
- ✅ **Clarity** - Is new content understandable to others? No ambiguities?
- ✅ **Completeness** - Are there missing explanations or examples?
- ✅ **Organization** - Is content in the right section? Logical flow?
- ✅ **Duplicates** - Did you accidentally add duplicate information?
- ✅ **Actualized Knowledge** - Does it reflect actual project patterns, not assumptions?
- ✅ **Project-Specific** - Are findings truly specific to THIS project, not general patterns?
- ✅ **Accuracy** - Are commands, paths, and technical details correct?

**.workflow/feature_template.md:**

- ✅ **Improvements** - Does it need any improvements based on this feature?
- ✅ **Completeness** - Are there sections that should be added?
- ✅ **Clarity** - Are instructions and examples clear?
- ✅ **Consistency** - Does it align with the actual workflow?

**Your feature plan (.features/YYYY-MM-DD-HHMM-name.md):**

- ✅ **Completion** - All checkboxes marked
- ✅ **Summary** - Completion summary filled in
- ✅ **Learnings** - Learnings documented (and already added to workflow docs!)
- ✅ **Accuracy** - Progress tracking reflects what actually happened

### Why This Matters

**Incremental updates during feature work are essential**, but a final review ensures:

1. **Consistency** - All documents align with each other
2. **Clarity** - No ambiguities or unclear instructions
3. **Actualized Knowledge** - Documents reflect reality, not just plans
4. **Quality** - High-quality, useful documentation for future work
5. **No Contradictions** - Documents don't contradict each other
6. **Proper Categorization** - General vs project-specific knowledge is correctly separated

**This review is NOT optional** - it's a critical part of completing any feature.

**IMPORTANT:** Use a dedicated review subagent to perform this review and save your main context. See the "Using Subagents" section above for the review subagent prompt template.

---

## 📚 Summary

**The Five Documents:**

1. **.workflow/README.md** - How to use this system
2. **.workflow/findings.md** - General development patterns
3. **.workflow/project_knowledge.md** - Project-specific knowledge
4. **.workflow/feature_template.md** - Template for new features
5. **.features/YYYY-MM-DD-HHMM-name.md** - Current feature plan

**Key Rules:**

1. **Update ALL FIVE documents continuously as you work!**
2. **Use subagents heavily to manage context** - Your LLM context fills up fast
3. **Always use a review subagent at the end** - Mandatory for quality assurance
