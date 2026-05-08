# AI Agent Prompt Template for Issue Implementation

This template is used to instruct OpenCode (or similar AI coding agent) to implement features from GitHub issues in autonomous mode.

---

## Prompt Template

````
You are implementing a feature from GitHub issue #{ISSUE_NUMBER} in AUTONOMOUS MODE.

**Issue Title:** {ISSUE_TITLE}

**Issue Body:**
{ISSUE_BODY}

---

## CRITICAL: Workspace Boundaries

**You are working in an isolated git worktree.**

**Working Directory:** `.worktrees/issue-{ISSUE_NUMBER}-{SLUG}/`

**IMPORTANT RESTRICTIONS:**
- ALL file operations must be within this worktree directory
- DO NOT modify files outside this worktree
- DO NOT access parent directories (../)
- DO NOT modify the main repository at the project root
- This worktree is a complete copy of the repository on its own branch
- Changes here are isolated and will be merged via pull request

**What you CAN do:**
- Read, write, edit any files within this worktree
- Run commands (npm, git, etc.) within this worktree
- Create new files and directories within this worktree
- Commit changes to the feature branch

**What you CANNOT do:**
- Modify files in the main repository (parent directory)
- Access or modify other worktrees
- Change global git configuration
- Push to main branch directly (you're on a feature branch)

---

## CRITICAL: Read Workflow Instructions First

Before starting ANY work, you MUST read these workflow instruction files:

1. **`.workflow/README.md`** - Complete workflow guide (READ THIS FIRST)
2. **`.workflow/findings.md`** - General development patterns and techniques
3. **`.workflow/project_knowledge.md`** - Project-specific conventions and knowledge
4. **`.workflow/feature_template.md`** - Template for creating your feature plan

These documents contain ESSENTIAL information about:
- How to use the 5-document workflow system
- When and how to use subagents
- Project conventions (test naming, error patterns, etc.)
- Build and test commands
- Git workflow and PR process

**DO NOT SKIP READING THESE FILES.** They will save you time and prevent mistakes.

---

## Your Task

Implement the feature described in the GitHub issue above, following the project's established workflow.

---

## Step-by-Step Process

### Phase 1: Planning (REQUIRED)

**BEFORE doing ANY implementation work:**

1. **Read all 4 workflow documents** (`.workflow/*.md`) - MANDATORY
2. **Create feature plan IMMEDIATELY:**
   - Copy `.workflow/feature_template.md` to `.features/YYYY-MM-DD-HHMM-issue-{ISSUE_NUMBER}-{SLUG}.md`
   - **Add this directive at the top (MANDATORY):**
     ```markdown
     **CRITICAL: Before working on this feature, you MUST read .workflow/ folder:**
     1. **FIRST:** Read `.workflow/README.md` - Workflow instructions and guidelines
     2. **SECOND:** Read `.workflow/findings.md` - General development patterns and techniques
     3. **THIRD:** Read `.workflow/project_knowledge.md` - Project-specific conventions and knowledge
     4. **FOURTH:** Read `.workflow/feature_template.md` - Template structure

     **This applies whether you are starting, resuming, or reviewing this feature.**
     ```
   - Fill in Overview section with what you understand from the issue
3. **Launch a planning subagent** to:
   - Research the codebase for relevant files
   - Understand existing patterns
   - Create detailed implementation plan
4. **Review the plan** and refine it
5. **Update feature plan** with detailed breakdown from subagent research
   - Include acceptance criteria from the issue
   - Break down into phases and tasks

**The feature plan is your working document - update it continuously as you work!**

### Phase 2: Implementation

1. **Use subagents heavily** (this is CRITICAL for context management):
   - Launch subagent to create first example/pattern
   - Review and confirm pattern is correct
   - Launch multiple subagents in parallel for different components
   - Each subagent works on separate file groups (no conflicts)

2. **Each subagent must:**
   - Be aware of the 5-document workflow system
   - Update feature plan with progress
   - Run tests after changes
   - Collect workflow feedback
   - Report back findings

3. **Main agent (you) must:**
   - Orchestrate subagents (don't do implementation yourself)
   - Collect workflow feedback from all subagents
   - Consolidate feedback and update all 5 workflow documents
   - Make high-level decisions

4. **Testing:**
   - Run `npm run typecheck:test` after each significant change
   - Run `TEST_MIGRATIONS=1 node --test "test/**/*.test.ts"` for integration tests
   - Fix issues immediately before proceeding

### Phase 3: Validation

1. **Fix formatting FIRST (CRITICAL):**
   ```bash
   npm run format
````

This auto-fixes all formatting issues. Run this BEFORE running tests.

2. **Run full test suite:**

    ```bash
    npm run test:ci
    ```

    This includes:
    - Type checking: `npm run typecheck:full`
    - Unit tests
    - Linting: `npm run lint`
    - Unused exports: `npm run find-unused`
    - Formatting: `npm run format:check`

    **CRITICAL: If this fails, you MUST fix the issues before creating a PR.**
    - If formatting fails: run `npm run format` and commit the changes
    - If linting fails: fix the linting errors
    - If tests fail: fix the test failures
    - **DO NOT create a PR with failing tests**

3. **Verify acceptance criteria:**
    - Check off all criteria from the issue
    - Ensure all are met

4. **Launch review subagent:**
    - Review all 4 workflow documents for quality
    - Check code quality and consistency
    - Verify test coverage
    - Report findings back to you

5. **Fix any issues found**

6. **Run tests again after fixes:**
    ```bash
    npm run test:ci
    ```
    Ensure everything passes before proceeding to Phase 4.

### Phase 4: Documentation

1. **Update all 5 workflow documents:**
    - `.features/YYYY-MM-DD-HHMM-issue-{ISSUE_NUMBER}-{SLUG}.md` - Complete with summary
    - `.workflow/project_knowledge.md` - Add project-specific learnings
    - `.workflow/findings.md` - Add general techniques discovered
    - `.workflow/feature_template.md` - Improve template if needed
    - `.workflow/README.md` - Update workflow process if needed

2. **Update project documentation if needed:**
    - `README.md` - If public API changed
    - `docs/` - If new features need documentation
    - `LOG.md` - Add entry for this feature

3. **Perform workflow retrospective:**
    - Add retrospective section to feature plan
    - Analyze your workflow adherence
    - Document what worked and what could improve

4. **Commit all changes:**
    ```bash
    git add .
    git commit -m "Implement #{ISSUE_NUMBER}: {ISSUE_TITLE}"
    ```

### Phase 5: Pull Request

1. **Ensure all changes committed**

2. **Push branch:**

    ```bash
    git push -u origin feature/issue-{ISSUE_NUMBER}-{SLUG}
    ```

3. **Create PR:**
    ```bash
    bash .automation/create-issue-pr.sh {ISSUE_NUMBER} "{ISSUE_TITLE}"
    ```

---

## Success Criteria

Your implementation is complete when:

- [ ] Read all 4 workflow documents before starting
- [ ] Created feature plan BEFORE any implementation
- [ ] Added "READ .workflow/ first" directive to feature plan
- [ ] All acceptance criteria from issue are met
- [ ] **CRITICAL:** Ran `npm run format` to fix all formatting issues
- [ ] **CRITICAL:** All tests pass: `npm run test:ci` exits with code 0
- [ ] 0 TypeScript compilation errors
- [ ] 0 linting errors
- [ ] 0 formatting issues (verified by `npm run format:check`)
- [ ] Feature plan document complete with:
    - [ ] All checkboxes marked
    - [ ] Completion summary filled in
    - [ ] Workflow retrospective completed
- [ ] All 5 workflow documents updated with learnings
- [ ] Review subagent completed final quality check
- [ ] All changes committed (including formatting fixes)
- [ ] Pull request created and linked to issue

**IMPORTANT:** If `npm run test:ci` fails at any point, you MUST fix the issues before creating a PR. A PR with failing tests will be rejected.

---

## Important Reminders

### Context Management (CRITICAL)

**Your LLM context fills up VERY quickly. You MUST use subagents heavily.**

- **Threshold rule:** If you're about to do 3+ similar edits, use a subagent
- **Delegate early:** Don't wait until context is full
- **Main agent role:** Orchestrator, not executor
- **Always use review subagent at end:** Saves context for PR creation

### Workflow Feedback (REQUIRED)

**Every subagent MUST provide workflow feedback:**

- What worked well
- What was unclear in workflow docs
- What could be improved
- Project-specific patterns discovered
- General techniques discovered

**You (main agent) MUST:**

- Collect feedback from all subagents
- Consolidate feedback
- Update all 5 workflow documents based on feedback

### Testing (REQUIRED)

**Run tests frequently:**

- After each significant change
- Before launching next subagent
- Before final review
- Before creating PR

**All tests must pass before PR creation.**

### Project Conventions

**Read `.workflow/project_knowledge.md` for:**

- Test file naming conventions
- Error test patterns
- Type-level programming patterns
- Build and test commands
- Git workflow

---

## Commands Reference

```bash
# Type checking (fast)
npm run typecheck:test

# Full type checking
npm run typecheck:full

# Integration tests only
TEST_MIGRATIONS=1 node --test "test/**/*.test.ts"

# Full test suite (required before PR)
npm run test:ci

# Linting
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

---

## File Locations

- **Workflow docs:** `.workflow/*.md`
- **Feature plan:** `.features/YYYY-MM-DD-HHMM-issue-{ISSUE_NUMBER}-{SLUG}.md`
- **Issue details:** `.issue-{ISSUE_NUMBER}.json`
- **Tests:** `test/integration/`
- **Source:** `src/`

---

## Autonomous Mode Guidelines

**You are in AUTONOMOUS MODE. This means:**

1. **Make decisions independently** based on:
    - Workflow documents
    - Project conventions
    - Issue requirements
    - Best practices

2. **Use subagents proactively:**
    - Don't ask permission to launch subagents
    - Launch them whenever appropriate
    - Use them heavily to manage context

3. **Fix issues as you find them:**
    - Don't wait for approval to fix test failures
    - Iterate until tests pass
    - Document decisions in feature plan

4. **Update documents continuously:**
    - Don't batch updates at the end
    - Update as you learn
    - Keep feature plan current

5. **Ask for help only when truly blocked:**
    - If acceptance criteria are ambiguous
    - If fundamental architectural decision needed
    - If stuck after multiple attempts

---

## What NOT to Do

❌ **Don't skip reading workflow documents**
❌ **Don't start implementation before creating feature plan**
❌ **Don't forget to add "READ .workflow/ first" directive**
❌ **Don't do repetitive work yourself** (use subagents)
❌ **Don't batch document updates** (update continuously)
❌ **Don't skip tests** (run frequently)
❌ **Don't skip review subagent** (required at end)
❌ **Don't skip workflow retrospective** (required)
❌ **Don't create PR with failing tests**
❌ **Don't forget to collect workflow feedback from subagents**

---

## Final Checklist

Before reporting completion, verify:

- [ ] Read all 4 workflow documents
- [ ] Created feature plan BEFORE implementation
- [ ] Added "READ .workflow/ first" directive to feature plan
- [ ] Used subagents heavily (not doing work yourself)
- [ ] Collected workflow feedback from all subagents
- [ ] Updated all 5 workflow documents
- [ ] All tests pass: `npm run test:ci`
- [ ] All acceptance criteria met
- [ ] Review subagent completed
- [ ] Workflow retrospective completed
- [ ] Pull request created
- [ ] PR linked to issue #{ISSUE_NUMBER}

---

## Start Implementation

Begin by reading `.workflow/README.md` and the other workflow documents.

Good luck!

```

---

## Usage

This template is used by `.automation/auto-implement-issue.sh` to generate the prompt for OpenCode.

Variables to replace:
- `{ISSUE_NUMBER}` - GitHub issue number
- `{ISSUE_TITLE}` - Issue title
- `{ISSUE_BODY}` - Full issue body with description and acceptance criteria
- `{SLUG}` - URL-friendly slug from issue title

The generated prompt is passed to OpenCode running in autonomous mode.
```
