# Development Workflow Guide

## 🔄 The Five-Document System

**When working on ANY feature, you MUST continuously update ALL FIVE DOCUMENTS:**

1. **README.md** (this file) - Workflow instructions
2. **findings.md** - General development findings
3. **project_knowledge.md** - Project-specific knowledge
4. **feature_template.md** - Template for new features
5. **YYYY-MM-DD-HHMM-feature-name.md** - Your current feature plan

**Update ALL FIVE documents throughout development, not just at the end!**

---

## 📁 The Five Documents Explained

### 1. README.md (this file)

**Purpose:** Workflow instructions and guidelines

**Update when:**
- Workflow process changes
- New best practices for using these documents
- Instructions need clarification

**Contains:**
- How to use the 5-document system
- Decision tree for which document to update
- Workflow guidelines

---

### 2. findings.md

**Purpose:** General development findings (applicable to ANY project)

**Update when you discover:**
- 🐛 **Debugging techniques** - TypeScript tricks, investigation methods
- ⚡ **Workflow patterns** - What works well (like using subagents)
- 📊 **Efficiency insights** - What worked well, what didn't
- 🎯 **General best practices** - Applicable to any project

**Examples:**
- "TypeScript type debugging: const _n: never = 1 as unknown as T"
- "Subagents work well for batch migrations (saved 4-5 hours)"
- "Infrastructure tests catch issues early"

---

### 3. project_knowledge.md

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

### 4. feature_template.md

**Purpose:** Template for creating new feature plans

**Update when:**
- Template structure needs improvement
- New sections should be added to feature plans
- Better examples are discovered

**Use this:**
- Copy this template when starting a new feature
- Name it: YYYY-MM-DD-HHMM-feature-name.md

---

### 5. YYYY-MM-DD-HHMM-feature-name.md (your current feature)

**Purpose:** Track progress for THIS specific feature

**Create at start:** Use timestamp format `YYYY-MM-DD-HHMM-feature-name.md`
- Example: `2026-05-08-0430-error-message-checking.md`

**Update continuously with:**
- ✅ Mark checkboxes as tasks complete
- 📝 Track what you've done in this session
- ⚠️ Document blockers or issues specific to this feature
- 📊 Update progress tracking and next steps
- 🎯 Feature-specific decisions and temporary workarounds

**Update frequency:** After completing each significant step or task

---

## 🤔 Decision Tree: Which Document to Update?

### Question 1: Is this about the workflow process itself?

**YES** → Update **README.md**
- Example: "Add new step to workflow"
- Example: "Clarify when to update documents"

**NO** → Go to Question 2

### Question 2: Is this about THIS feature only?

**YES** → Update **your feature plan** (YYYY-MM-DD-HHMM-name.md)
- Example: "Completed migration of 10 INSERT test files"
- Example: "Blocked on understanding error message format"
- Example: "Next: migrate UPDATE test files"

**NO** → Go to Question 3

### Question 3: Is this specific to THIS project?

**YES** → Update **project_knowledge.md**
- Example: "Test files must follow {operation}-{scenario}.{success|error}.test.ts naming"
- Example: "This project uses tsgo for faster type checking"
- Example: "SQL parser returns tuples: [NewDbShape, Tokens, Error]"

**NO** → Update **findings.md**
- Example: "TypeScript type debugging: const _n: never = 1 as unknown as T"
- Example: "Subagents work well for batch migrations"
- Example: "Infrastructure tests catch issues early"

### Question 4: Is this about the feature template?

**YES** → Update **feature_template.md**
- Example: "Add new section for performance considerations"
- Example: "Improve TODO checklist structure"

---

## 📋 Complete Workflow

### At Start of Feature:

1. Copy **feature_template.md** to **YYYY-MM-DD-HHMM-feature-name.md**
2. Fill in the initial sections (Overview, Goals, Strategy)
3. Create detailed TODO checklist

### During Feature Work:

**Update ALL FIVE documents as you discover new information:**

1. **Your feature plan** - After each significant step
2. **project_knowledge.md** - When discovering project-specific patterns
3. **findings.md** - When discovering general techniques
4. **feature_template.md** - When improving the template
5. **README.md** - When improving the workflow process

### At End of Feature:

1. Review **project_knowledge.md** for consistency
2. Review **findings.md** for consistency
3. Review **README.md** for any workflow improvements
4. Mark feature plan as complete
5. Create PR

---

## 🎯 Why This Matters

- **For you:** Build knowledge that makes future work faster
- **For others:** Share learnings so they don't repeat your work
- **For the project:** Create a living knowledge base that grows over time

**Remember: Update ALL FIVE documents continuously throughout development!**

---

## 📝 End-of-Feature Review Checklist

Before creating PR, review all documents:

**README.md:**
- ✅ Are workflow instructions still accurate?
- ✅ Do any guidelines need updating?

**findings.md:**
- ✅ **Consistency** - Do new sections fit with existing content?
- ✅ **Clarity** - Is new content understandable to others?
- ✅ **Completeness** - Are there missing explanations or examples?
- ✅ **Organization** - Is content in the right section?
- ✅ **Duplicates** - Did you accidentally add duplicate information?

**project_knowledge.md:**
- ✅ Same checks as findings.md

**feature_template.md:**
- ✅ Does it need any improvements based on this feature?

**Your feature plan:**
- ✅ All checkboxes marked
- ✅ Completion summary filled in
- ✅ Learnings documented

**Why:** Incremental updates during feature work are great, but a final review ensures all documents remain high-quality and useful.

---

## 📚 Summary

**The Five Documents:**
1. **README.md** - How to use this system
2. **findings.md** - General development patterns
3. **project_knowledge.md** - Project-specific knowledge
4. **feature_template.md** - Template for new features
5. **YYYY-MM-DD-HHMM-name.md** - Current feature plan

**Key Rule:** Update ALL FIVE documents continuously as you work!
