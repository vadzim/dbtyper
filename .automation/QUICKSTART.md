# Automated Issue Implementation - Quick Start Guide

This guide helps you get started with the automated GitHub issue implementation system.

---

## Prerequisites

1. **GitHub CLI (`gh`)** - For fetching issues and creating PRs
   ```bash
   # Install on Ubuntu/Debian
   sudo apt install gh
   
   # Authenticate
   gh auth login
   ```

2. **OpenCode** - AI coding agent
   ```bash
   # Should already be installed
   opencode --version
   ```

3. **Node.js and npm** - For running tests
   ```bash
   node --version  # Should be v24+
   npm --version
   ```

4. **jq** - For JSON parsing
   ```bash
   sudo apt install jq
   ```

---

## Setup (One-time)

1. **Copy configuration file:**
   ```bash
   cd .automation
   cp config.example.json config.json
   ```

2. **Verify scripts are executable:**
   ```bash
   ls -l *.sh
   # All should have 'x' permission
   ```

3. **Test GitHub CLI access:**
   ```bash
   gh issue list --limit 5
   ```

---

## Usage

### Option 1: Manual Trigger (Recommended for Testing)

Implement a specific approved issue:

```bash
cd /home/vadzim/work/jsql
.automation/auto-implement-issue.sh <issue-number>
```

Example:
```bash
.automation/auto-implement-issue.sh 42
```

**What happens:**
1. Fetches issue #42 from GitHub
2. Verifies it has "approved" label
3. Creates worktree at `.worktrees/issue-42-{slug}/`
4. Installs dependencies
5. Launches OpenCode in autonomous mode
6. OpenCode implements the feature following workflow docs
7. Runs full test suite
8. Creates pull request
9. Links PR to issue

**Duration:** 30-90 minutes depending on complexity

### Option 2: Continuous Monitoring (Production)

Monitor all approved issues automatically:

```bash
cd /home/vadzim/work/jsql
.automation/monitor-approved-issues.sh
```

**What happens:**
- Checks for approved issues every 5 minutes
- Automatically starts implementation for new approved issues
- Processes up to 3 issues in parallel
- Runs continuously until stopped (Ctrl+C)

**Run in background:**
```bash
nohup .automation/monitor-approved-issues.sh > monitor.log 2>&1 &
```

---

## Workflow

### For Maintainers

1. **Review issue** - Ensure it's well-defined with acceptance criteria
2. **Add "approved" label** - This triggers automation
3. **Wait for PR** - Automation creates PR when done (30-90 min)
4. **Review PR** - Check code quality, tests, documentation
5. **Merge PR** - Use merge strategy (not squash)
6. **Cleanup** - Worktree is cleaned up automatically or manually

### For the Automation System

1. **Detect approval** - Monitor finds "approved" label
2. **Create worktree** - Isolated environment for feature
3. **Launch OpenCode** - AI agent implements feature
   - Reads `.workflow/` documentation
   - Creates feature plan in `.features/`
   - Uses subagents for parallel work
   - Runs tests continuously
   - Updates all 5 workflow documents
4. **Run tests** - Full test suite must pass
5. **Create PR** - Automatic PR with summary
6. **Wait for review** - Maintainer reviews and merges

---

## Monitoring Progress

### Check logs

```bash
# View latest log
ls -t .automation/logs/*.log | head -n 1 | xargs tail -f

# View log for specific issue
tail -f .automation/logs/issue-42-*.log
```

### Check processing status

```bash
# List currently processing issues
ls .automation/.processing/*.lock

# Check when processing started
cat .automation/.processing/issue-42.lock | xargs -I {} date -d @{}
```

### Check worktrees

```bash
# List all worktrees
git worktree list

# Check specific worktree
cd .worktrees/issue-42-*/
git status
git log
```

---

## Troubleshooting

### Issue not being processed

**Problem:** Issue has "approved" label but nothing happens

**Solutions:**
1. Check if lock file exists: `ls .automation/.processing/issue-*.lock`
2. Check logs: `ls .automation/logs/issue-*.log`
3. Manually trigger: `.automation/auto-implement-issue.sh <number>`

### OpenCode not found

**Problem:** `Error: OpenCode is not installed or not in PATH`

**Solution:**
```bash
which opencode
# If not found, ensure OpenCode is installed and in PATH
```

### Tests failing

**Problem:** Implementation completes but tests fail

**Solution:**
1. Check log for test failures
2. Go to worktree: `cd .worktrees/issue-*/`
3. Fix issues manually
4. Run tests: `npm run test:ci`
5. Commit fixes: `git commit -am "Fix test failures"`
6. Create PR: `.automation/create-issue-pr.sh <number> "<title>"`

### Worktree already exists

**Problem:** `Error: Worktree already exists`

**Solution:**
```bash
# Check if previous implementation is complete
cd .worktrees/issue-42-*/
git status

# If complete, clean up
cd /home/vadzim/work/jsql
.automation/cleanup-issue-worktree.sh 42 "Issue Title"

# Then retry
.automation/auto-implement-issue.sh 42
```

### Lock file stuck

**Problem:** Lock file exists but no process running

**Solution:**
```bash
# Remove stale lock file
rm .automation/.processing/issue-42.lock

# Then retry
.automation/auto-implement-issue.sh 42
```

---

## Manual Cleanup

### Clean up after merged PR

```bash
.automation/cleanup-issue-worktree.sh <issue-number> "<issue-title>"
```

Example:
```bash
.automation/cleanup-issue-worktree.sh 42 "Add support for UNION queries"
```

### Clean up all merged worktrees

```bash
# List merged branches
git branch --merged main | grep "feature/issue-"

# For each merged branch, clean up
# (Manual process - be careful!)
```

### Clean old logs

```bash
# Remove logs older than 30 days
find .automation/logs/ -name "*.log" -mtime +30 -delete
```

### Clean stale lock files

```bash
# Remove lock files older than 24 hours
find .automation/.processing/ -name "*.lock" -mtime +1 -delete
```

---

## Configuration

Edit `.automation/config.json`:

```json
{
  "automation": {
    "enabled": true,
    "approvalLabel": "approved",        // Label to trigger automation
    "autoMerge": false,                 // Auto-merge PRs (not recommended)
    "maxParallelImplementations": 3,    // Max concurrent implementations
    "checkInterval": 300                // Seconds between checks
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
  }
}
```

---

## Best Practices

### For Issues

**Good issue format:**
```markdown
## Description
Clear description of what needs to be implemented

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Details
- Files to modify: src/parser/parse-sql-statement.ts
- Pattern to follow: Similar to existing UNION implementation
- Tests needed: Integration tests in test/integration/

## Related Files
- `src/parser/parse-sql-statement.ts` - Main parser
- `test/integration/select/` - Test location
```

**Bad issue format:**
```markdown
Add UNION support
```

### For Maintainers

1. **Review issues before approving** - Ensure they're well-defined
2. **One feature per issue** - Don't combine multiple features
3. **Clear acceptance criteria** - Makes validation easier
4. **Review PRs promptly** - Don't let them pile up
5. **Provide feedback** - Help improve automation over time

---

## Safety Features

1. **Isolated worktrees** - Changes don't affect main repository
2. **Feature branches** - Never pushes to main directly
3. **Required code review** - All PRs need maintainer approval
4. **Test validation** - All tests must pass before PR creation
5. **Lock files** - Prevents duplicate processing
6. **Comprehensive logging** - Full audit trail of all actions

---

## Getting Help

1. **Check logs:** `.automation/logs/issue-*.log`
2. **Check documentation:** `.workflow/automated-issue-implementation.md`
3. **Check this guide:** `.automation/QUICKSTART.md`
4. **Open an issue:** Report problems on GitHub

---

## Example Session

```bash
# 1. Start in project root
cd /home/vadzim/work/jsql

# 2. Check for approved issues
gh issue list --label approved

# 3. Manually trigger implementation for issue #42
.automation/auto-implement-issue.sh 42

# 4. Monitor progress
tail -f .automation/logs/issue-42-*.log

# 5. Wait for completion (30-90 minutes)
# Output will show:
# - Worktree created
# - Dependencies installed
# - OpenCode launched
# - Tests running
# - PR created

# 6. Review PR on GitHub
gh pr view

# 7. After merge, clean up
.automation/cleanup-issue-worktree.sh 42 "Add support for UNION queries"
```

---

## Next Steps

1. **Test with a simple issue** - Start with something small
2. **Monitor the logs** - Watch how it works
3. **Review the PR** - Check code quality
4. **Provide feedback** - Help improve the system
5. **Enable continuous monitoring** - Once confident

---

## Success Metrics

Track these to measure automation effectiveness:

- Time from approval to PR creation
- Test pass rate on first attempt
- Number of iterations needed
- Acceptance criteria completion rate
- Maintainer review time
- Merge rate

---

## Support

For issues or questions:
- Check logs in `.automation/logs/`
- Review `.workflow/automated-issue-implementation.md`
- Open an issue on GitHub
