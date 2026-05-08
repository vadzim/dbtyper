# Automated Issue Implementation System

**Last Updated:** 2026-05-08

This directory contains tools for automatically implementing features from approved GitHub issues.

---

## Overview

The automation system monitors GitHub issues labeled "approved" by maintainers and automatically:
1. Creates isolated worktrees for feature development
2. Implements features using AI agents following the 5-document workflow
3. Runs comprehensive tests and validation
4. Creates pull requests for maintainer review

---

## Quick Start

### Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Node.js and npm installed
- Git worktrees support
- AI coding agent (OpenCode or similar)

### Setup

1. **Configure settings:**
   ```bash
   cp config.example.json config.json
   # Edit config.json with your settings
   ```

2. **Set environment variables:**
   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
   export REPO_OWNER=vadzim
   export REPO_NAME=dbtyper
   ```

3. **Start monitoring (optional):**
   ```bash
   ./monitor-approved-issues.sh
   ```

### Manual Implementation

To manually trigger implementation for a specific issue:

```bash
./auto-implement-issue.sh <issue-number>
```

Example:
```bash
./auto-implement-issue.sh 42
```

---

## Scripts

### `monitor-approved-issues.sh`

Continuously monitors GitHub issues for "approved" label.

**Usage:**
```bash
./monitor-approved-issues.sh
```

**Behavior:**
- Checks for approved issues every 5 minutes (configurable)
- Creates lock files to prevent duplicate processing
- Launches implementation in background for each approved issue

### `auto-implement-issue.sh`

Main orchestrator that implements a feature from a GitHub issue.

**Usage:**
```bash
./auto-implement-issue.sh <issue-number>
```

**Process:**
1. Fetches issue details from GitHub
2. Verifies "approved" label exists
3. Creates worktree
4. Installs dependencies
5. Launches AI agent for implementation
6. Creates pull request

### `create-issue-worktree.sh`

Creates an isolated worktree for issue implementation.

**Usage:**
```bash
./create-issue-worktree.sh <issue-number> <issue-title>
```

**Creates:**
- Worktree at `.worktrees/issue-{number}-{slug}/`
- Branch named `feature/issue-{number}-{slug}`

### `cleanup-issue-worktree.sh`

Cleans up worktree after PR is merged.

**Usage:**
```bash
./cleanup-issue-worktree.sh <issue-number> <issue-title>
```

**Removes:**
- Worktree directory
- Feature branch (if merged)

### `create-issue-pr.sh`

Creates a pull request for the implemented feature.

**Usage:**
```bash
./create-issue-pr.sh <issue-number> <issue-title>
```

**Creates:**
- PR with title "Implement #{number}: {title}"
- Links to original issue
- Includes summary and test results

---

## Configuration

### `config.json`

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

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token
- `REPO_OWNER` - Repository owner (default: vadzim)
- `REPO_NAME` - Repository name (default: dbtyper)
- `AGENT_MODEL` - AI model to use (default: kr/claude-sonnet-4.5)

---

## Directory Structure

```
.automation/
├── README.md                          # This file
├── config.json                        # Configuration settings
├── config.example.json                # Example configuration
├── monitor-approved-issues.sh         # Continuous monitoring
├── auto-implement-issue.sh            # Main orchestrator
├── create-issue-worktree.sh           # Worktree creation
├── cleanup-issue-worktree.sh          # Worktree cleanup
├── create-issue-pr.sh                 # PR creation
├── agent-prompt-template.md           # AI agent instructions
├── logs/                              # Implementation logs
│   └── issue-{number}-*.log
└── .processing/                       # Lock files
    └── issue-{number}.lock
```

---

## Workflow Integration

This automation system integrates with the project's 5-document workflow:

1. **`.workflow/README.md`** - Workflow instructions
2. **`.workflow/findings.md`** - General development findings
3. **`.workflow/project_knowledge.md`** - Project-specific knowledge
4. **`.workflow/feature_template.md`** - Template for new features
5. **`.features/YYYY-MM-DD-HHMM-issue-{number}-{slug}.md`** - Feature plan

The AI agent follows these workflow documents during implementation.

---

## Issue Requirements

For automation to work, GitHub issues should include:

```markdown
## Description
[Clear description of what needs to be implemented]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Details (optional)
[Implementation hints, constraints, patterns to follow]

## Related Files (optional)
- `path/to/file.ts` - [Description]

## Test Requirements
[What tests should be added or updated]
```

Maintainer adds "approved" label to trigger automation.

---

## Logs

Implementation logs are stored in `logs/`:

- `issue-{number}-implementation.log` - Full implementation log
- Includes timestamps, decisions, test results, errors

---

## Troubleshooting

### Issue not being processed

1. Check if "approved" label exists: `gh issue view {number}`
2. Check for lock file: `ls .processing/issue-{number}.lock`
3. Check logs: `cat logs/issue-{number}-*.log`

### Worktree already exists

```bash
# List worktrees
git worktree list

# Remove if needed
./cleanup-issue-worktree.sh {number} "{title}"
```

### Tests failing

The AI agent will attempt to fix test failures automatically. If stuck:
1. Check implementation log
2. Review PR draft (created even if incomplete)
3. Manually fix issues in worktree
4. Re-run tests: `npm run test:ci`

---

## Security

### Access Control

The automation system requires:
- Read access to issues
- Create branches
- Create PRs
- Add comments

It does NOT:
- Merge PRs automatically (unless explicitly enabled)
- Modify main branch directly
- Change repository settings

### Code Review

All PRs require maintainer approval before merging. Automation does not bypass code review.

---

## Maintenance

### Cleanup old worktrees

```bash
# List all worktrees
git worktree list

# Remove merged worktrees
for dir in .worktrees/issue-*; do
  ./cleanup-issue-worktree.sh $(basename "$dir" | cut -d- -f2) "$(basename "$dir" | cut -d- -f3-)"
done
```

### Clear old logs

```bash
# Remove logs older than 30 days
find logs/ -name "*.log" -mtime +30 -delete
```

### Clear lock files

```bash
# Remove stale lock files (older than 24 hours)
find .processing/ -name "*.lock" -mtime +1 -delete
```

---

## Future Enhancements

- Multi-issue dependency handling
- Partial implementation for large issues
- Learning from maintainer feedback
- Performance optimization with parallel implementations
- Integration with CI/CD for staging deployments

---

## Support

For issues or questions:
1. Check logs in `logs/`
2. Review `.workflow/automated-issue-implementation.md` for detailed documentation
3. Open an issue on GitHub
