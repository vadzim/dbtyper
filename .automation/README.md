# Automated Issue Implementation System

This directory contains tools for automatically implementing features from approved GitHub issues.

## Overview

The automation system monitors GitHub issues labeled "approved" and automatically:

1. Creates isolated worktrees for feature development
2. Implements features using AI agents
3. Runs comprehensive tests and validation
4. Creates pull requests for maintainer review

## Quick Start

### Prerequisites

- GitHub CLI (`gh`) - `gh auth login`
- Node.js v24+ and npm
- OpenCode AI agent
- jq for JSON parsing

### Usage

**Manual trigger (recommended for testing):**

```bash
npm run monitor  # Start monitoring (polling mode, default)
# or
.automation/auto-implement-issue.sh <issue-number>  # Single issue
```

**Continuous monitoring:**

```bash
npm run monitor -- --poll-interval 60 --max-concurrent 3
```

See [MONITOR-README.md](./MONITOR-README.md) for monitoring details.

## Scripts

### `monitor-github-labels.ts`

TypeScript-based monitoring with polling or webhook modes. See [MONITOR-README.md](./MONITOR-README.md).

### `auto-implement-issue.sh`

Main orchestrator that implements a feature from a GitHub issue.

**Process:**

1. Fetches issue details and verifies "approved" label
2. Creates worktree and installs dependencies
3. Launches OpenCode with 15-minute timeout
4. Runs test suite (must pass)
5. Creates pull request

### `create-issue-worktree.sh`

Creates isolated worktree at `.worktrees/issue-{number}-{slug}/` with branch `feature/issue-{number}-{slug}`.

### `cleanup-issue-worktree.sh`

Removes worktree and feature branch after PR is merged.

### `create-issue-pr.sh`

Creates pull request with title "Implement #{number}: {title}" and links to original issue.

## Configuration

### `config.json`

```json
{
	"automation": {
		"enabled": true,
		"approvalLabel": "approved",
		"maxParallelImplementations": 1
	},
	"github": {
		"owner": "vadzim",
		"repo": "dbtyper"
	}
}
```

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (or use `gh auth login`)

## Issue Requirements

For automation to work, GitHub issues should include:

```markdown
## Description

[Clear description of what needs to be implemented]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Details (optional)

[Implementation hints, constraints, patterns to follow]

## Test Requirements

[What tests should be added or updated]
```

Maintainer adds "approved" label to trigger automation.

## Labels

- `approved` (green) - Triggers automation (maintainers only)
- `in-progress` (yellow) - Currently being implemented (auto-managed)

See [LABELS.md](./LABELS.md) for detailed label documentation.

## Troubleshooting

### Issue not being processed

1. Check if "approved" label exists: `gh issue view {number}`
2. Check for lock file: `ls .processing/issue-{number}.lock`
3. Check logs: `cat logs/issue-{number}-*.log`

### Worktree already exists

```bash
git worktree list
./cleanup-issue-worktree.sh {number} "{title}"
```

### Tests failing

Check implementation log and manually fix in worktree, then re-run tests.

## Maintenance

```bash
# Clear old logs (30+ days)
find logs/ -name "*.log" -mtime +30 -delete

# Clear stale lock files (24+ hours)
find .processing/ -name "*.lock" -mtime +1 -delete
```

## Files

- `monitor-github-labels.ts` - TypeScript monitoring system
- `auto-implement-issue.sh` - Main implementation orchestrator
- `create-issue-worktree.sh` - Worktree creation
- `cleanup-issue-worktree.sh` - Worktree cleanup
- `create-issue-pr.sh` - PR creation
- `agent-prompt-template.md` - AI agent instructions
- `config.example.json` - Configuration template
- `logs/` - Implementation logs
- `.processing/` - Lock files
