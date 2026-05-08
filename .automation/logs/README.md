# Automation logs directory

This directory contains implementation logs for automated issue implementations.

## Log Format

Logs are named: `issue-{number}-{timestamp}.log`

Example: `issue-42-20260508-143022.log`

## Contents

Each log contains:
- Timestamp of each phase
- Issue details fetched from GitHub
- Worktree creation output
- Dependency installation output
- OpenCode execution output
- Test results
- PR creation output
- Any errors or warnings

## Retention

Logs are kept indefinitely by default. To clean up old logs:

```bash
# Remove logs older than 30 days
find . -name "*.log" -mtime +30 -delete
```

## Viewing Logs

```bash
# View latest log
ls -t *.log | head -n 1 | xargs cat

# View log for specific issue
cat issue-42-*.log

# Follow log in real-time
tail -f issue-42-*.log
```
