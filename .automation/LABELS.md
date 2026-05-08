# GitHub Labels for Automation System

**Created:** 2026-05-08  
**Status:** ✅ Active

---

## Labels Overview

| Label         | Color               | Description                                         | Who Can Add      | Purpose                 |
| ------------- | ------------------- | --------------------------------------------------- | ---------------- | ----------------------- |
| `approved`    | 🟢 Green (#0e8a16)  | Approved by maintainer for automated implementation | Maintainers only | Triggers automation     |
| `in-progress` | 🟡 Yellow (#fbca04) | Currently being implemented                         | Anyone           | Prevents duplicate work |

---

## Label Workflows

### Automated Implementation Flow

```
Issue created
    ↓
Maintainer reviews
    ↓
Maintainer adds "approved" label
    ↓
Automation detects approval
    ↓
Automation adds "in-progress" label
    ↓
Implementation happens (30-90 min)
    ↓
PR created
    ↓
Automation removes "in-progress" label
    ↓
Issue automatically closed when PR merged
```

### Manual Implementation Flow

```
Issue created
    ↓
You decide to implement it yourself
    ↓
You add "in-progress" label
    ↓
You implement the feature
    ↓
You create PR
    ↓
You remove "in-progress" label
    ↓
You merge PR
    ↓
Issue closed
```

---

## Label Meanings

### `approved` Label

**Meaning:** This issue has been reviewed and approved for implementation by a maintainer.

**Effect:**

- Automation system will detect this label
- Implementation will start automatically (if monitoring is running)
- Or can be manually triggered with: `.automation/auto-implement-issue.sh <number>`

**Who can add:** Only repository collaborators with Triage role or higher (currently only @vadzim)

**When to add:**

- Issue is well-defined with clear acceptance criteria
- Feature aligns with project goals
- Ready for implementation

**When NOT to add:**

- Issue needs more discussion
- Requirements are unclear
- Duplicate of another issue
- Out of scope for the project

### `in-progress` Label

**Meaning:** Someone is currently working on implementing this issue.

**Effect:**

- Signals to others that work is in progress
- Prevents duplicate effort
- Helps track active work

**Who can add:** Anyone (maintainers or contributors)

**Automatically managed by automation:**

- ✅ Added when automation starts implementation
- ✅ Removed when PR is created
- ✅ Removed if implementation fails

**Manual usage:**

- Add when you start working on an issue yourself
- Remove when you create a PR or stop working on it

**When to add manually:**

- You're implementing the feature yourself
- You want to prevent others from working on it
- You're actively working on it (not just planning)

**When NOT to add:**

- You're just thinking about it
- You might work on it later
- You're waiting for feedback

---

## Checking Label Status

### Via GitHub CLI

```bash
# List all approved issues
gh issue list --label approved

# List all in-progress issues
gh issue list --label in-progress

# List issues with both labels (automation is working on them)
gh issue list --label approved --label in-progress

# Check specific issue labels
gh issue view <number> --json labels --jq '.labels[].name'
```

### Via GitHub Web

Go to: https://github.com/vadzim/dbtyper/issues

Filter by labels:

- Click "Labels" dropdown
- Select `approved` or `in-progress`

---

## Label Management

### Add Labels

```bash
# Add approved label (maintainers only)
gh issue edit <number> --add-label approved

# Add in-progress label (anyone)
gh issue edit <number> --add-label in-progress

# Add both
gh issue edit <number> --add-label approved,in-progress
```

### Remove Labels

```bash
# Remove approved label
gh issue edit <number> --remove-label approved

# Remove in-progress label
gh issue edit <number> --remove-label in-progress

# Remove both
gh issue edit <number> --remove-label approved,in-progress
```

### List All Labels

```bash
gh label list
```

---

## Common Scenarios

### Scenario 1: Automated Implementation

```bash
# 1. Maintainer approves issue
gh issue edit 42 --add-label approved

# 2. Automation adds in-progress (automatic)
# Issue now has: approved, in-progress

# 3. Implementation happens (30-90 min)

# 4. PR created, in-progress removed (automatic)
# Issue now has: approved only

# 5. PR merged, issue closed (automatic via "Closes #42")
```

### Scenario 2: Manual Implementation

```bash
# 1. You decide to implement issue 42 yourself
gh issue edit 42 --add-label in-progress

# 2. You work on it
cd .worktrees/my-feature/
# ... implement ...

# 3. You create PR
gh pr create --title "..." --body "Closes #42"

# 4. You remove in-progress label
gh issue edit 42 --remove-label in-progress

# 5. You merge PR, issue closes automatically
```

### Scenario 3: Automation Failure

```bash
# 1. Automation starts
# Issue has: approved, in-progress

# 2. Implementation fails (tests don't pass)

# 3. Automation removes in-progress (automatic)
# Issue has: approved only

# 4. Check logs to see what failed
tail -f .automation/logs/issue-42-*.log

# 5. Fix manually or retry
.automation/auto-implement-issue.sh 42
```

### Scenario 4: Preventing Automation

```bash
# You want to implement an approved issue yourself

# 1. Add in-progress label before automation picks it up
gh issue edit 42 --add-label in-progress

# 2. Automation will skip it (sees in-progress label)

# 3. Implement it yourself

# 4. Remove in-progress when done
gh issue edit 42 --remove-label in-progress
```

---

## Best Practices

### For Maintainers

✅ **Do:**

- Review issues thoroughly before adding `approved`
- Add `in-progress` yourself when implementing manually
- Remove `in-progress` if you stop working on something
- Monitor issues with both labels (automation is working)

❌ **Don't:**

- Add `approved` to unclear issues
- Leave `in-progress` on abandoned work
- Add `approved` to duplicates

### For Contributors

✅ **Do:**

- Add `in-progress` when you start working
- Remove `in-progress` when you create PR
- Check for `in-progress` before starting work
- Ask maintainer to add `approved` if needed

❌ **Don't:**

- Try to add `approved` yourself (won't work)
- Add `in-progress` if not actually working on it
- Leave `in-progress` on abandoned work

---

## Troubleshooting

### Issue has `approved` but automation didn't start

**Possible reasons:**

1. Monitoring script is not running
2. Issue already has `in-progress` label
3. Lock file exists (already processing)

**Solutions:**

```bash
# Check if monitoring is running
ps aux | grep monitor-approved-issues

# Manually trigger
.automation/auto-implement-issue.sh <number>

# Check for lock file
ls .automation/.processing/issue-<number>.lock
```

### Issue stuck with `in-progress` label

**Possible reasons:**

1. Automation crashed before removing it
2. Someone added it manually and forgot to remove it

**Solutions:**

```bash
# Check if actually in progress
ls .automation/.processing/issue-<number>.lock
git worktree list | grep issue-<number>

# If not in progress, remove label
gh issue edit <number> --remove-label in-progress
```

### Can't add `approved` label

**Reason:** You don't have Triage role or higher on the repository.

**Solution:** Only maintainers can add this label. Request approval from @vadzim.

---

## Summary

✅ **Two labels created:** `approved` and `in-progress`  
✅ **`approved`** triggers automation (maintainers only)  
✅ **`in-progress`** prevents duplicate work (anyone can add)  
✅ **Automation manages `in-progress` automatically**  
✅ **Can be used for manual implementations too**

**Next:** Add `approved` label to an issue and watch the automation work!

---

**Created:** 2026-05-08  
**Last Updated:** 2026-05-08  
**Status:** ✅ Active
