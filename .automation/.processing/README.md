# Processing Lock Files

This directory contains lock files for issues currently being processed.

## Purpose

Lock files prevent duplicate processing of the same issue when running multiple automation instances.

## Format

Lock files are named: `issue-{number}.lock`

Contents: Unix timestamp of when processing started

## Cleanup

Lock files are automatically removed when:
- Implementation completes successfully
- Implementation fails
- Script is interrupted (manual cleanup may be needed)

## Manual Cleanup

If a lock file is stale (process crashed or was killed):

```bash
# Remove specific lock file
rm issue-42.lock

# Remove all stale lock files (older than 24 hours)
find . -name "*.lock" -mtime +1 -delete
```

## Checking Status

```bash
# List currently processing issues
ls -lh *.lock 2>/dev/null

# Check when processing started
cat issue-42.lock | xargs -I {} date -d @{}
```
