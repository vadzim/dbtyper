# Automated GitHub Issue Implementation System - Complete Documentation

**Created:** 2026-05-08  
**Status:** Ready for use  
**Location:** `.automation/` and `.workflow/`

---

## Overview

This system automatically implements features from GitHub issues that have been approved by maintainers. It uses OpenCode AI agent running in autonomous mode, following the project's established 5-document workflow system.

---

## System Architecture

### Components

```
GitHub Issue (labeled "approved")
    ↓
monitor-approved-issues.sh (continuous monitoring)
    ↓
auto-implement-issue.sh (main orchestrator)
    ↓
create-issue-worktree.sh (isolated environment)
    ↓
OpenCode AI Agent (autonomous implementation)
    ├─ Reads .workflow/ documentation
    ├─ Creates .features/ plan
    ├─ Uses subagents for parallel work
    ├─ Runs tests continuously
    └─ Updates all 5 workflow documents
    ↓
create-issue-pr.sh (pull request creation)
    ↓
Maintainer Review (manual approval required)
    ↓
Merge to main
    ↓
cleanup-issue-worktree.sh (cleanup)
```

### File Structure

```
.automation/
├── README.md                          # Main documentation
├── QUICKSTART.md                      # Quick start guide
├── config.example.json                # Configuration template
├── .gitignore                         # Ignore patterns
├── monitor-approved-issues.sh         # Continuous monitoring
├── auto-implement-issue.sh            # Main orchestrator
├── create-issue-worktree.sh           # Worktree creation
├── cleanup-issue-worktree.sh          # Worktree cleanup
├── create-issue-pr.sh                 # PR creation
├── agent-prompt-template.md           # OpenCode instructions
├── logs/                              # Implementation logs
│   └── README.md
└── .processing/                       # Lock files
    └── README.md

.workflow/
├── README.md                          # Workflow guide
├── findings.md                        # General patterns
├── project_knowledge.md               # Project-specific knowledge
├── feature_template.md                # Feature plan template
└── automated-issue-implementation.md  # Detailed automation docs

.worktrees/
└── issue-{number}-{slug}/             # Isolated implementation environments
    ├── .issue-{number}.json           # Issue details
    ├── .agent-prompt-{number}.md      # Generated prompt
    └── .features/                     # Feature plan
        └── YYYY-MM-DD-HHMM-issue-{number}-{slug}.md
```

---

## Key Features

### 1. Isolated Worktrees
- Each issue implemented in separate git worktree
- No interference with main repository
- Clean separation of concerns
- Easy cleanup after merge

### 2. Autonomous AI Implementation
- OpenCode runs in fully autonomous mode
- Follows 5-document workflow system
- Uses subagents for parallel work
- Continuous testing and validation

### 3. Comprehensive Testing
- Type checking: `npm run typecheck:full`
- Unit tests: `TEST_MIGRATIONS=1 node --test`
- Linting: `npm run lint`
- Formatting: `npm run format:check`
- All must pass before PR creation

### 4. Workflow Integration
- Reads workflow documentation before starting
- Creates feature plan using template
- Updates all 5 workflow documents
- Performs workflow retrospective

### 5. Safety & Control
- Maintainer approval required (via "approved" label)
- All PRs require code review
- Comprehensive logging
- Lock files prevent duplicate processing
- Workspace boundaries enforced

---

## Documentation Files

### User Documentation

1. **`.automation/QUICKSTART.md`** - Quick start guide
   - Prerequisites and setup
   - Usage instructions
   - Troubleshooting
   - Examples

2. **`.automation/README.md`** - Main documentation
   - Overview and architecture
   - Script descriptions
   - Configuration options
   - Maintenance procedures

3. **`.workflow/automated-issue-implementation.md`** - Detailed design
   - Complete process description
   - Phase-by-phase breakdown
   - Error handling
   - Security considerations
   - Example workflow

### Technical Documentation

4. **`.automation/agent-prompt-template.md`** - AI agent instructions
   - Complete prompt template
   - Workspace boundaries
   - Step-by-step process
   - Success criteria
   - Commands reference

5. **`.automation/config.example.json`** - Configuration template
   - All available settings
   - Default values
   - Comments explaining each option

### Supporting Documentation

6. **`.automation/logs/README.md`** - Log file documentation
7. **`.automation/.processing/README.md`** - Lock file documentation

---

## Usage Scenarios

### Scenario 1: Single Issue Implementation (Manual Trigger)

**Use case:** Test the system or implement a specific issue

```bash
cd /home/vadzim/work/jsql
.automation/auto-implement-issue.sh 42
```

**Duration:** 30-90 minutes  
**Output:** Pull request created and linked to issue

### Scenario 2: Continuous Monitoring (Production)

**Use case:** Automatically process all approved issues

```bash
cd /home/vadzim/work/jsql
.automation/monitor-approved-issues.sh
```

**Behavior:**
- Checks every 5 minutes (configurable)
- Processes up to 3 issues in parallel (configurable)
- Runs continuously until stopped

### Scenario 3: Background Processing

**Use case:** Run monitoring as a background service

```bash
cd /home/vadzim/work/jsql
nohup .automation/monitor-approved-issues.sh > monitor.log 2>&1 &
```

**Management:**
```bash
# Check status
ps aux | grep monitor-approved-issues

# View logs
tail -f monitor.log

# Stop
pkill -f monitor-approved-issues
```

---

## Configuration

### Environment Variables

```bash
# GitHub token (optional, uses gh auth by default)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Repository details (auto-detected from git remote)
export REPO_OWNER=vadzim
export REPO_NAME=dbtyper

# OpenCode model (optional, uses default)
export AGENT_MODEL=kr/claude-sonnet-4.5
```

### Configuration File

Edit `.automation/config.json`:

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

## Issue Requirements

For automation to work effectively, issues should follow this format:

```markdown
## Description
Clear description of what needs to be implemented

## Acceptance Criteria
- [ ] Criterion 1 - Specific, testable requirement
- [ ] Criterion 2 - Specific, testable requirement
- [ ] Criterion 3 - Specific, testable requirement

## Technical Details (optional)
- Files to modify: src/parser/parse-sql-statement.ts
- Pattern to follow: Similar to existing UNION implementation
- Constraints: Must maintain backward compatibility

## Related Files (optional)
- `src/parser/parse-sql-statement.ts` - Main parser
- `test/integration/select/` - Test location

## Test Requirements
- Add integration tests for success cases
- Add error tests for invalid syntax
- Update existing tests if behavior changes
```

**Maintainer adds "approved" label to trigger automation.**

---

## Workflow Integration

The automation system integrates with the existing 5-document workflow:

### 1. `.workflow/README.md`
- Workflow instructions
- How to use the 5-document system
- Subagent usage guidelines

### 2. `.workflow/findings.md`
- General development patterns
- Debugging techniques
- Workflow efficiency insights

### 3. `.workflow/project_knowledge.md`
- Project-specific conventions
- Build and test tools
- Architecture insights

### 4. `.workflow/feature_template.md`
- Template for feature plans
- Sections and structure
- Progress tracking format

### 5. `.features/YYYY-MM-DD-HHMM-issue-{number}-{slug}.md`
- Current feature plan
- Created by AI agent
- Updated throughout implementation
- Includes completion summary and retrospective

**The AI agent reads documents 1-4 before starting, then creates and updates document 5.**

---

## OpenCode Integration

### How OpenCode is Invoked

```bash
opencode run \
  --dir "$WORKTREE_PATH" \
  --title "Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}" \
  --dangerously-skip-permissions \
  "$AGENT_PROMPT"
```

### Key Flags

- `--dir` - Sets working directory to worktree
- `--title` - Sets session title for tracking
- `--dangerously-skip-permissions` - Enables fully autonomous mode (auto-approves actions)

### Agent Prompt

The prompt instructs OpenCode to:
1. Read all workflow documentation
2. Stay within worktree boundaries
3. Follow 5-document workflow system
4. Use subagents heavily
5. Run tests continuously
6. Update all workflow documents
7. Create pull request when done

---

## Safety Mechanisms

### 1. Workspace Isolation
- Each issue in separate worktree
- Changes don't affect main repository
- Feature branch, not main branch

### 2. Code Review Required
- All PRs need maintainer approval
- Automation doesn't bypass review
- Maintainer has final say

### 3. Test Validation
- All tests must pass before PR
- Type checking, unit tests, linting, formatting
- Failures block PR creation

### 4. Lock Files
- Prevent duplicate processing
- One implementation per issue at a time
- Automatic cleanup on completion

### 5. Comprehensive Logging
- Full audit trail of all actions
- Timestamps for each phase
- Error messages and stack traces
- Test results

### 6. Workspace Boundaries
- AI agent instructed to stay within worktree
- Cannot modify main repository
- Cannot access parent directories

---

## Monitoring & Debugging

### Check Implementation Status

```bash
# List currently processing issues
ls .automation/.processing/*.lock

# View latest log
ls -t .automation/logs/*.log | head -n 1 | xargs tail -f

# Check worktrees
git worktree list

# Check specific worktree status
cd .worktrees/issue-42-*/
git status
git log
```

### Common Issues

1. **OpenCode not found**
   - Ensure OpenCode is installed: `which opencode`
   - Check PATH includes OpenCode binary

2. **Tests failing**
   - Check log for specific failures
   - Go to worktree and fix manually
   - Re-run tests: `npm run test:ci`

3. **Worktree already exists**
   - Previous implementation may be incomplete
   - Check status: `cd .worktrees/issue-*/; git status`
   - Clean up if needed: `.automation/cleanup-issue-worktree.sh`

4. **Lock file stuck**
   - Process may have crashed
   - Check if process running: `ps aux | grep auto-implement`
   - Remove stale lock: `rm .automation/.processing/issue-*.lock`

---

## Maintenance

### Regular Maintenance

```bash
# Clean old logs (30+ days)
find .automation/logs/ -name "*.log" -mtime +30 -delete

# Clean stale lock files (24+ hours)
find .automation/.processing/ -name "*.lock" -mtime +1 -delete

# Clean merged worktrees
git worktree list
# For each merged worktree:
.automation/cleanup-issue-worktree.sh <number> "<title>"
```

### Monitoring Health

Track these metrics:
- Time from approval to PR creation
- Test pass rate on first attempt
- Number of iterations needed
- Acceptance criteria completion rate
- PR merge rate

---

## Future Enhancements

Potential improvements:

1. **Multi-issue dependencies** - Handle issues that depend on others
2. **Partial implementation** - Break large issues into smaller PRs
3. **Learning from feedback** - Improve based on maintainer reviews
4. **Performance optimization** - Better parallel processing
5. **CI/CD integration** - Automatic staging deployments
6. **Metrics dashboard** - Visualize automation effectiveness
7. **Slack/Discord notifications** - Alert when PRs are ready
8. **Auto-merge option** - For trusted automation (with safeguards)

---

## Getting Started

### First Time Setup

1. **Install prerequisites:**
   ```bash
   # GitHub CLI
   sudo apt install gh
   gh auth login
   
   # jq for JSON parsing
   sudo apt install jq
   
   # Verify OpenCode
   opencode --version
   ```

2. **Configure automation:**
   ```bash
   cd .automation
   cp config.example.json config.json
   # Edit config.json if needed
   ```

3. **Test with a simple issue:**
   ```bash
   # Create a test issue on GitHub with "approved" label
   # Then run:
   .automation/auto-implement-issue.sh <issue-number>
   ```

4. **Monitor progress:**
   ```bash
   tail -f .automation/logs/issue-*.log
   ```

5. **Review the PR:**
   ```bash
   gh pr view
   ```

6. **Enable continuous monitoring (optional):**
   ```bash
   nohup .automation/monitor-approved-issues.sh > monitor.log 2>&1 &
   ```

---

## Summary

This automated system:

✅ **Monitors** GitHub issues for maintainer approval  
✅ **Implements** features in isolated worktrees  
✅ **Follows** the project's 5-document workflow  
✅ **Uses** AI agents with heavy subagent delegation  
✅ **Runs** comprehensive tests and validation  
✅ **Creates** high-quality pull requests  
✅ **Maintains** code quality and documentation standards  
✅ **Preserves** maintainer control through code review  

**Key Benefits:**
- Faster feature implementation (30-90 minutes automated)
- Consistent code quality (follows established patterns)
- Comprehensive documentation (all 5 documents updated)
- Reduced maintainer workload (focus on review, not implementation)
- Continuous workflow improvement (retrospectives after each feature)

**Maintainer Control:**
- Approves issues before implementation starts
- Reviews all PRs before merging
- Can reject or request changes
- Full visibility into implementation process

---

## Support & Documentation

- **Quick Start:** `.automation/QUICKSTART.md`
- **Main Docs:** `.automation/README.md`
- **Detailed Design:** `.workflow/automated-issue-implementation.md`
- **Workflow Guide:** `.workflow/README.md`
- **Logs:** `.automation/logs/`

For issues or questions, open an issue on GitHub.

---

**System Status:** ✅ Ready for use  
**Last Updated:** 2026-05-08  
**Version:** 1.0
