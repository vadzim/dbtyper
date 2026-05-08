# Development Workflow Guide

**When working on ANY feature, you MUST continuously update:**
- Your **feature plan** (`docs/features/YYYY-MM-DD-HHMM-feature-name.md`)
- **All relevant documents** in the `docs/workflow/` folder

Each document has a specific purpose. Update them as you discover new information.

---

## 🔄 The Three-Document Workflow

### 1. Feature Plan (`docs/features/YYYY-MM-DD-HHMM-feature-name.md`)

**Purpose:** Track progress and decisions for THIS specific feature

**Create at start:** Use timestamp format `YYYY-MM-DD-HHMM-feature-name.md`
- Example: `2026-05-08-0430-error-message-checking.md`

**Update for:**
- ✅ Mark checkboxes as tasks complete
- 📝 Track what you've done in this session
- ⚠️ Document blockers or issues specific to this feature
- 📊 Update progress tracking and next steps
- 🎯 Feature-specific decisions and temporary workarounds

**Update frequency:** After completing each significant step or task

---

### 2. Project Knowledge (`docs/workflow/knowledge.md`)

**Purpose:** Document project-specific knowledge that applies to ALL features

**Update when you discover:**
- 🏗️ **Project conventions** - Patterns that apply to all features
- 🔧 **Tool usage** - Commands, build tools, how things work
- 🧠 **Architecture insights** - How the system is structured
- 💡 **Solutions to common problems** - Pitfalls and how to avoid them
- 📋 **Project-specific conventions** - Naming, structure, rules

**Update frequency:** Immediately when you discover something reusable

---

### 3. General Findings (`docs/workflow/findings.md`)

**Purpose:** Document general development patterns and learnings (not project-specific)

**Update when you discover:**
- ⚡ **Workflow patterns** - What works well (like using subagents)
- 🐛 **Debugging techniques** - TypeScript tricks, investigation methods
- 📊 **Efficiency insights** - What worked well, what didn't
- 🎯 **General best practices** - Applicable to any project

**Update frequency:** Immediately when you discover something reusable

---

## 🤔 Decision Tree: Which Document to Update?

### Step 1: Is this about THIS feature only?

**YES** → Update **Feature Plan** (`docs/features/YYYY-MM-DD-HHMM-feature-name.md`)
- Example: "Completed migration of 10 INSERT test files"
- Example: "Blocked on understanding error message format"
- Example: "Next: migrate UPDATE test files"

**NO** → Go to Step 2

### Step 2: Is this specific to THIS project?

**YES** → Update **Project Knowledge** (`docs/workflow/knowledge.md`)
- Example: "Test files must follow {operation}-{scenario}.{success|error}.test.ts naming"
- Example: "This project uses tsgo for faster type checking"
- Example: "SQL parser returns tuples: [NewDbShape, Tokens, Error]"

**NO** → Update **General Findings** (`docs/workflow/findings.md`)
- Example: "TypeScript type debugging: const _n: never = 1 as unknown as T"
- Example: "Subagents work well for batch migrations (saved 4-5 hours)"
- Example: "Infrastructure tests catch issues early"

---

## 📋 Complete Workflow

### At Start of Feature:
1. Create feature plan: `docs/features/YYYY-MM-DD-HHMM-feature-name.md`
2. Use template from this directory

### During Feature Work:
1. Update **Feature Plan** after each significant step
2. Update **Project Knowledge** when discovering project-specific patterns
3. Update **General Findings** when discovering general techniques

### At End of Feature:
1. Review **Project Knowledge** for consistency
2. Review **General Findings** for consistency
3. Mark feature plan as complete
4. Create PR

---

## 🎯 Why This Matters

- **For you:** Build knowledge that makes future work faster
- **For others:** Share learnings so they don't repeat your work
- **For the project:** Create a living knowledge base that grows over time

**Remember: Update all THREE documents throughout development, not just at the end!**

---

## 📝 End-of-Feature Review Checklist

Before creating PR, review the two knowledge documents:

**Project Knowledge (`docs/workflow/knowledge.md`):**
- ✅ **Consistency** - Do new sections fit with existing content?
- ✅ **Clarity** - Is new content understandable to others?
- ✅ **Completeness** - Are there missing explanations or examples?
- ✅ **Organization** - Is content in the right section?
- ✅ **Duplicates** - Did you accidentally add duplicate information?

**General Findings (`docs/workflow/findings.md`):**
- ✅ Same checks as above

**Why:** Incremental updates during feature work are great, but a final review ensures documents remain high-quality and useful.

---

## 📚 See Also

- `docs/workflow/knowledge.md` - Project-specific knowledge base
- `docs/workflow/findings.md` - General development findings
- `docs/features/` - Individual feature plans
- `docs/features/template.md` - Template for new feature plans
