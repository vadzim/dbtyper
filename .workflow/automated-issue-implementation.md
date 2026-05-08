# Automated GitHub Issue Implementation Process

**Date:** 2026-05-08  
**Purpose:** Define the automated workflow for implementing features from approved GitHub issues

**Part of the workflow system:**
- This document describes the automated process for implementing features from GitHub issues
- Integrates with the 5-document system (.workflow/README.md, findings.md, project_knowledge.md, feature_template.md, .features/*)
- Uses git worktrees for isolated feature development
- Follows the project's established workflow patterns

---

## Overview

This document describes an automated system for:
1. Monitoring GitHub issues for maintainer approval
2. Automatically creating feature branches in separate worktrees
3. Implementing features using AI agents following the 5-document workflow
4. Running tests and validation
5. Creating pull requests for maintainer review
6. Merging approved features back to main

---

## Architecture

### Components

1. **Issue Monitor** - Watches for approved issues
2. **Worktree Manager** - Creates isolated development environments
3. **Feature Implementer** - AI agent that implements the feature
4. **Test Runner** - Validates implementation
5. **PR Manager** - Creates and manages pull requests
6. **Merge Controller** - Handles approved PR merging

### Data Flow

```
GitHub Issue (labeled "approved")
    ↓
Issue Monitor detects approval
    ↓
Worktree Manager creates .worktrees/issue-{number}-{slug}
    ↓
Feature Implementer (AI agent) implements feature
    ├─ Creates .features/YYYY-MM-DD-HHMM-issue-{number}-{slug}.md
    ├─ Follows 5-document workflow
    ├─ Uses subagents for parallel work
    ├─ Updates workflow documents
    └─ Runs tests continuously
    ↓
Test Runner validates implementation
    ├─ npm run typecheck:full
    ├─ npm run test:ci
    └─ All checks must pass
    ↓
PR Manager creates pull request
    ├─ Title: "Implement #{number}: {issue title}"
    ├─ Body: Summary of changes
    ├─ Links to original issue
    └─ Includes test results
    ↓
Maintainer reviews PR
    ↓
Merge Controller merges approved PR
    └─ Cleans up worktree
```

---

## GitHub Issue Requirements

### Issue Label System

**Required label for automation:** `approved`

**Optional labels for categorization:**
- `feature` - New feature implementation
- `bug` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation update
- `test` - Test improvements
- `performance` - Performance optimization

### Issue Template

Issues should contain:

```markdown
## Description
[Clear description of what needs to be implemented]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Details (optional)
[Any technical constraints, patterns to follow, or implementation hints]

## Related Files (optional)
- `path/to/file1.ts` - [Description]
- `path/to/file2.ts` - [Description]

## Test Requirements
[What tests should be added or updated]
```

### Approval Process

1. Maintainer reviews issue
2. Maintainer adds `approved` label
3. Automation system detects approval
4. Implementation begins automatically

---

## Worktree Management

### Worktree Creation

**Location:** `.worktrees/issue-{number}-{slug}/`

**Example:** `.worktrees/issue-42-add-union-type-support/`

**Branch naming:** `feature/issue-{number}-{slug}`

**Example:** `feature/issue-42-add-union-type-support`

### Worktree Setup Script

```bash
#!/bin/bash
# scripts/create-issue-worktree.sh

ISSUE_NUMBER=$1
ISSUE_TITLE=$2

# Create slug from title
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

# Branch and worktree names
BRANCH="feature/issue-${ISSUE_NUMBER}-${SLUG}"
WORKTREE_PATH=".worktrees/issue-${ISSUE_NUMBER}-${SLUG}"

# Create worktree
git worktree add -b "$BRANCH" "$WORKTREE_PATH" main

echo "Created worktree: $WORKTREE_PATH"
echo "Branch: $BRANCH"
```

### Worktree Cleanup

```bash
#!/bin/bash
# scripts/cleanup-issue-worktree.sh

ISSUE_NUMBER=$1
ISSUE_TITLE=$2

SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
WORKTREE_PATH=".worktrees/issue-${ISSUE_NUMBER}-${SLUG}"
BRANCH="feature/issue-${ISSUE_NUMBER}-${SLUG}"

# Remove worktree
git worktree remove "$WORKTREE_PATH"

# Delete branch (if merged)
git branch -d "$BRANCH"

echo "Cleaned up worktree: $WORKTREE_PATH"
```

---

## Feature Implementation Process

### Phase 1: Planning (Automated)

**Agent Task:** Research and create feature plan

**Steps:**
1. Read GitHub issue content
2. Extract requirements and acceptance criteria
3. Research relevant codebase areas using explore agent
4. Create feature plan in `.features/YYYY-MM-DD-HHMM-issue-{number}-{slug}.md`
5. Use `.workflow/feature_template.md` as template
6. Include issue link and acceptance criteria

**Deliverables:**
- Feature plan document
- Initial task breakdown
- Identified files to modify

### Phase 2: Implementation (Automated)

**Agent Task:** Implement feature following 5-document workflow

**Steps:**
1. Launch planning subagent to refine implementation strategy
2. Create first example/pattern (if applicable)
3. Launch implementation subagents in parallel for different components
4. Each subagent:
   - Works on separate file groups (no conflicts)
   - Updates feature plan with progress
   - Collects workflow feedback
   - Runs tests after changes
5. Main agent consolidates feedback
6. Main agent updates all 5 workflow documents:
   - `.features/YYYY-MM-DD-HHMM-issue-{number}-{slug}.md` - progress
   - `.workflow/project_knowledge.md` - project-specific patterns
   - `.workflow/findings.md` - general techniques
   - `.workflow/feature_template.md` - template improvements (if needed)
   - `.workflow/README.md` - workflow improvements (if needed)

**Testing Strategy:**
- Run `npm run typecheck:test` after each significant change
- Run `TEST_MIGRATIONS=1 node --test "test/**/*.test.ts"` for integration tests
- Fix issues immediately before proceeding

**Deliverables:**
- Implemented feature code
- Updated tests
- Updated feature plan with progress

### Phase 3: Validation (Automated)

**Agent Task:** Comprehensive testing and validation

**Steps:**
1. Run full test suite: `npm run test:ci`
   - Type checking: `npm run typecheck:full`
   - Unit tests: `TEST_MIGRATIONS=1 node --test "test/**/*.test.ts"`
   - Linting: `npm run lint`
   - Unused exports: `npm run find-unused`
   - Formatting: `npm run format:check`
2. Verify all acceptance criteria met
3. Launch review subagent for final quality check
4. Review subagent checks:
   - Code quality and consistency
   - Test coverage
   - Documentation completeness
   - Workflow document quality
5. Fix any issues found
6. Re-run tests until all pass

**Success Criteria:**
- All tests pass (0 failures)
- 0 TypeScript compilation errors
- 0 linting errors
- 0 formatting issues
- All acceptance criteria checked off

**Deliverables:**
- Passing test suite
- Validated implementation
- Quality-checked workflow documents

### Phase 4: Documentation (Automated)

**Agent Task:** Finalize documentation and workflow updates

**Steps:**
1. Ensure all 5 workflow documents are updated
2. Verify feature plan completion summary
3. Perform workflow retrospective
4. Update project documentation if needed:
   - `README.md` - if public API changed
   - `docs/` - if new features need documentation
   - `LOG.md` - add entry for this feature
5. Commit all changes with clear message

**Deliverables:**
- Complete feature plan with retrospective
- Updated workflow documents
- Updated project documentation
- Clean git history

### Phase 5: Pull Request (Automated)

**Agent Task:** Create pull request for maintainer review

**Steps:**
1. Ensure all changes committed
2. Push branch to remote: `git push -u origin feature/issue-{number}-{slug}`
3. Create PR using GitHub CLI:
   ```bash
   gh pr create \
     --title "Implement #${ISSUE_NUMBER}: ${ISSUE_TITLE}" \
     --body "$(cat <<'EOF'
   ## Summary
   Implements #${ISSUE_NUMBER}
   
   [Brief description of changes]
   
   ## Changes Made
   - Change 1
   - Change 2
   - Change 3
   
   ## Acceptance Criteria
   - [x] Criterion 1
   - [x] Criterion 2
   - [x] Criterion 3
   
   ## Test Results
   - ✅ Type checking: passed
   - ✅ Unit tests: passed (X tests)
   - ✅ Linting: passed
   - ✅ Formatting: passed
   
   ## Files Modified
   - `path/to/file1.ts` - [Description]
   - `path/to/file2.ts` - [Description]
   
   Closes #${ISSUE_NUMBER}
   EOF
   )" \
     --base main
   ```
4. Link PR to issue (using "Closes #X" in description)

**Deliverables:**
- Created pull request
- Linked to original issue
- Ready for maintainer review

---

## Automation Script Structure

### Main Orchestrator

```bash
#!/bin/bash
# scripts/auto-implement-issue.sh

ISSUE_NUMBER=$1

# 1. Fetch issue details
ISSUE_JSON=$(gh issue view "$ISSUE_NUMBER" --json title,body,labels)
ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')
LABELS=$(echo "$ISSUE_JSON" | jq -r '.labels[].name')

# 2. Verify "approved" label
if ! echo "$LABELS" | grep -q "approved"; then
  echo "Error: Issue #$ISSUE_NUMBER is not approved"
  exit 1
fi

# 3. Create worktree
bash scripts/create-issue-worktree.sh "$ISSUE_NUMBER" "$ISSUE_TITLE"

SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
WORKTREE_PATH=".worktrees/issue-${ISSUE_NUMBER}-${SLUG}"

# 4. Change to worktree
cd "$WORKTREE_PATH" || exit 1

# 5. Install dependencies
npm ci

# 6. Launch AI agent for implementation
# This would integrate with OpenCode or similar AI coding agent
# The agent receives:
# - Issue number, title, body
# - Acceptance criteria
# - Workflow documents location
# - Instructions to follow 5-document workflow

echo "Starting AI agent implementation for issue #$ISSUE_NUMBER"
# AI agent implementation here...

# 7. After implementation, create PR
bash scripts/create-issue-pr.sh "$ISSUE_NUMBER" "$ISSUE_TITLE"

# 8. Return to main directory
cd ../..

echo "Implementation complete. PR created for issue #$ISSUE_NUMBER"
```

### Issue Monitor (Continuous)

```bash
#!/bin/bash
# scripts/monitor-approved-issues.sh

# Run continuously or as cron job
while true; do
  # Get all open issues with "approved" label
  APPROVED_ISSUES=$(gh issue list --label approved --json number --jq '.[].number')
  
  for ISSUE_NUMBER in $APPROVED_ISSUES; do
    # Check if already being processed
    if [ -f ".processing/issue-${ISSUE_NUMBER}.lock" ]; then
      continue
    fi
    
    # Create lock file
    mkdir -p .processing
    touch ".processing/issue-${ISSUE_NUMBER}.lock"
    
    # Start implementation in background
    bash scripts/auto-implement-issue.sh "$ISSUE_NUMBER" &
  done
  
  # Wait before next check (e.g., 5 minutes)
  sleep 300
done
```

---

## AI Agent Integration

### Agent Prompt Template

```markdown
You are implementing a feature from GitHub issue #{ISSUE_NUMBER}.

**Issue Title:** {ISSUE_TITLE}

**Issue Body:**
{ISSUE_BODY}

**Your Task:**
Implement this feature following the project's 5-document workflow system.

**Workflow Documents:**
1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/YYYY-MM-DD-HHMM-issue-{ISSUE_NUMBER}-{SLUG}.md - Your feature plan

**Critical Instructions:**
1. Read all 4 workflow documents before starting
2. Create feature plan using template
3. Use subagents heavily for parallel work
4. Update all 5 documents continuously
5. Run tests after each significant change
6. Collect workflow feedback from subagents
7. Launch review subagent at the end
8. Perform workflow retrospective

**Success Criteria:**
- All acceptance criteria from issue met
- All tests pass (npm run test:ci)
- All 5 workflow documents updated
- Feature plan includes completion summary and retrospective

**Commands Available:**
- npm run typecheck:test - Fast type checking
- npm run test:ci - Full test suite
- TEST_MIGRATIONS=1 node --test "test/**/*.test.ts" - Integration tests only
- npm run lint - Linting
- npm run format - Auto-format code

**When Complete:**
Report back with:
1. Summary of changes made
2. Test results
3. Files modified
4. Acceptance criteria status
5. Any issues or blockers encountered
```

### Agent Configuration

**Context Management:**
- Use subagents heavily to preserve main context
- Main agent orchestrates, subagents execute
- Collect workflow feedback from all subagents
- Main agent consolidates and updates workflow docs

**Testing Strategy:**
- Run tests after each significant change
- Fix issues immediately before proceeding
- Full test suite must pass before PR creation

**Documentation:**
- Update all 5 workflow documents continuously
- Feature plan tracks progress in real-time
- Workflow retrospective at end

---

## Error Handling

### Implementation Failures

**If tests fail:**
1. Agent analyzes failure
2. Agent fixes issues
3. Agent re-runs tests
4. Repeat until tests pass
5. If stuck after 3 attempts, escalate to maintainer

**If implementation blocked:**
1. Agent documents blocker in feature plan
2. Agent creates draft PR with current progress
3. Agent adds comment explaining blocker
4. Maintainer reviews and provides guidance

**If acceptance criteria unclear:**
1. Agent documents ambiguity in feature plan
2. Agent makes reasonable assumptions
3. Agent documents assumptions in PR description
4. Maintainer clarifies during review

### Worktree Conflicts

**If worktree already exists:**
1. Check if previous implementation is complete
2. If complete, clean up old worktree
3. If incomplete, resume previous implementation

**If branch already exists:**
1. Check if branch is merged
2. If merged, delete branch and create new one
3. If not merged, resume work on existing branch

---

## Quality Assurance

### Pre-PR Checklist

Automated checks before PR creation:

- [ ] All tests pass: `npm run test:ci`
- [ ] 0 TypeScript errors
- [ ] 0 linting errors
- [ ] 0 formatting issues
- [ ] All acceptance criteria met
- [ ] Feature plan complete with retrospective
- [ ] All 5 workflow documents updated
- [ ] Review subagent completed final check
- [ ] All commits have clear messages
- [ ] No temporary debug code left

### Code Quality Standards

**Follow project conventions:**
- Test file naming: `{operation}-{scenario}.{success|error}.test.ts`
- Unused variables start with `_`
- Error tests use `ExtractQueryError` pattern
- Type-level operations use clean shapes, not runtime types

**Testing requirements:**
- Add tests for new features
- Update tests for changed behavior
- Maintain or improve test coverage
- All tests must pass

**Documentation requirements:**
- Update README if public API changed
- Update docs/ if new features added
- Add entry to LOG.md
- Update workflow documents with learnings

---

## Merge Process

### Automated Merge (Optional)

**If enabled:**
1. Maintainer approves PR
2. Automation detects approval
3. Automation merges PR using merge strategy (not squash)
4. Automation cleans up worktree
5. Automation closes issue

**Command:**
```bash
gh pr merge {PR_NUMBER} --auto --merge
```

### Manual Merge (Default)

1. Maintainer reviews PR
2. Maintainer approves and merges manually
3. Manual cleanup of worktree if needed

---

## Monitoring and Logging

### Implementation Logs

**Location:** `.logs/issue-{number}-implementation.log`

**Contents:**
- Timestamp of each phase
- Agent decisions and reasoning
- Test results
- Errors and fixes
- Workflow feedback collected

### Metrics to Track

- Time from approval to PR creation
- Test pass rate on first attempt
- Number of iterations needed
- Acceptance criteria completion rate
- Workflow document update frequency

---

## Configuration

### Environment Variables

```bash
# GitHub token for API access
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Repository details
REPO_OWNER=vadzim
REPO_NAME=dbtyper

# Automation settings
AUTO_MERGE_ENABLED=false
ISSUE_CHECK_INTERVAL=300  # seconds
MAX_PARALLEL_IMPLEMENTATIONS=3

# AI agent settings
AGENT_MODEL=kr/claude-sonnet-4.5
AGENT_MAX_CONTEXT=200000
```

### Configuration File

```json
{
  "automation": {
    "enabled": true,
    "approvalLabel": "approved",
    "autoMerge": false,
    "maxParallelImplementations": 3,
    "checkInterval": 300
  },
  "worktree": {
    "basePath": ".worktrees",
    "branchPrefix": "feature/issue-",
    "cleanupAfterMerge": true
  },
  "testing": {
    "runAfterEachChange": true,
    "requiredChecks": [
      "typecheck:full",
      "test:ci",
      "lint",
      "format:check"
    ]
  },
  "documentation": {
    "updateWorkflowDocs": true,
    "requireRetrospective": true,
    "updateProjectDocs": true
  }
}
```

---

## Security Considerations

### Code Review

**Automated implementation does NOT bypass code review:**
- All PRs require maintainer approval
- Maintainer reviews code quality
- Maintainer verifies acceptance criteria
- Maintainer checks for security issues

### Access Control

**GitHub token permissions:**
- Read issues
- Create branches
- Create PRs
- Add comments
- Read repository contents

**NOT allowed:**
- Merge PRs (unless explicitly enabled)
- Modify main branch directly
- Change repository settings
- Manage access controls

### Validation

**Before merging:**
- All tests must pass
- Code review approved
- No security vulnerabilities detected
- Follows project conventions

---

## Rollback Procedure

### If Implementation Fails

1. Close PR without merging
2. Clean up worktree
3. Delete feature branch
4. Remove "approved" label from issue
5. Add "needs-revision" label
6. Comment on issue explaining failure

### If Merged Code Has Issues

1. Create hotfix branch
2. Fix issues
3. Create emergency PR
4. Fast-track review and merge
5. Document in LOG.md

---

## Future Enhancements

### Potential Improvements

1. **Multi-issue dependencies**
   - Handle issues that depend on other issues
   - Implement in correct order

2. **Partial implementation**
   - Break large issues into smaller PRs
   - Implement incrementally

3. **Learning from feedback**
   - Analyze maintainer feedback on PRs
   - Improve implementation patterns over time

4. **Performance optimization**
   - Parallel implementation of independent issues
   - Caching of common patterns

5. **Integration with CI/CD**
   - Automatic deployment to staging
   - Integration tests in staging environment

---

## Example Workflow

### Complete Example: Issue #42

**Issue Title:** "Add support for UNION queries"

**Issue Body:**
```markdown
## Description
Add support for SQL UNION queries with type checking

## Acceptance Criteria
- [ ] Parse UNION and UNION ALL syntax
- [ ] Type check that both queries have compatible schemas
- [ ] Return combined result type
- [ ] Add integration tests

## Technical Details
- Extend parser in src/parser/parse-sql-statement.ts
- Add UNION token to lexer
- Update type inference for combined results
```

**Automation Flow:**

1. **Detection (t=0)**
   - Maintainer adds "approved" label
   - Monitor detects approval within 5 minutes

2. **Worktree Creation (t=5m)**
   - Creates `.worktrees/issue-42-add-support-for-union-queries/`
   - Creates branch `feature/issue-42-add-support-for-union-queries`
   - Runs `npm ci`

3. **Planning Phase (t=10m)**
   - AI agent reads issue
   - Launches planning subagent
   - Creates `.features/2026-05-08-0745-issue-42-add-support-for-union-queries.md`
   - Identifies files to modify:
     - `src/lexer/sql-tokens.ts` - Add UNION token
     - `src/parser/parse-sql-statement.ts` - Parse UNION syntax
     - `src/types/query-result.ts` - Type inference for UNION
     - `test/integration/select/select-union.success.test.ts` - New test

4. **Implementation Phase (t=20m - t=60m)**
   - Subagent 1: Lexer changes
   - Subagent 2: Parser changes
   - Subagent 3: Type inference
   - Subagent 4: Tests
   - Each runs tests after changes
   - Main agent consolidates feedback
   - Main agent updates all 5 workflow documents

5. **Validation Phase (t=65m)**
   - Runs `npm run test:ci`
   - All tests pass
   - Launch review subagent
   - Review subagent verifies quality
   - All acceptance criteria met

6. **Documentation Phase (t=70m)**
   - Updates feature plan with completion summary
   - Performs workflow retrospective
   - Updates README with UNION support
   - Adds entry to LOG.md
   - Commits all changes

7. **PR Creation (t=75m)**
   - Pushes branch to remote
   - Creates PR with summary
   - Links to issue #42
   - Includes test results

8. **Review and Merge (t=24h)**
   - Maintainer reviews PR
   - Maintainer approves
   - Maintainer merges
   - Worktree cleaned up
   - Issue #42 closed automatically

**Total Time:** ~75 minutes automated + maintainer review time

---

## Summary

This automated system:
- Monitors GitHub issues for maintainer approval
- Implements features in isolated worktrees
- Follows the project's 5-document workflow
- Uses AI agents with heavy subagent delegation
- Runs comprehensive tests and validation
- Creates high-quality pull requests
- Maintains code quality and documentation standards

**Key Benefits:**
- Faster feature implementation
- Consistent code quality
- Comprehensive documentation
- Reduced maintainer workload
- Continuous workflow improvement

**Maintainer Control:**
- Approves issues before implementation
- Reviews all PRs before merging
- Can reject or request changes
- Full visibility into implementation process
