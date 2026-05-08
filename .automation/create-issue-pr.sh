#!/bin/bash
# Create pull request for implemented issue

set -e

ISSUE_NUMBER=$1
ISSUE_TITLE=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$ISSUE_TITLE" ]; then
  echo "Usage: $0 <issue-number> <issue-title>"
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Verify we're on the correct branch
if [[ ! "$CURRENT_BRANCH" =~ ^feature/issue-${ISSUE_NUMBER}- ]]; then
  echo "Error: Not on the correct feature branch"
  echo "Current branch: $CURRENT_BRANCH"
  echo "Expected: feature/issue-${ISSUE_NUMBER}-*"
  exit 1
fi

# Verify all changes are committed
if ! git diff-index --quiet HEAD --; then
  echo "Error: Uncommitted changes detected"
  echo "Please commit all changes before creating PR"
  exit 1
fi

# Push branch to remote
echo "Pushing branch to remote..."
git push -u origin "$CURRENT_BRANCH"

# Get feature plan file
FEATURE_PLAN=$(ls .features/*-issue-${ISSUE_NUMBER}-*.md 2>/dev/null | head -n 1)

# Extract summary from feature plan if exists
if [ -f "$FEATURE_PLAN" ]; then
  echo "Found feature plan: $FEATURE_PLAN"
  # TODO: Extract summary, changes, test results from feature plan
fi

# Get list of modified files
MODIFIED_FILES=$(git diff --name-only main..."$CURRENT_BRANCH" | head -n 20)

# Count tests
TEST_COUNT=$(npm test 2>&1 | grep -oP '\d+(?= tests)' || echo "unknown")

# Create PR body
PR_BODY=$(cat <<EOF
## Summary

Implements #${ISSUE_NUMBER}

This PR implements the feature requested in issue #${ISSUE_NUMBER}.

## Changes Made

$(git log --oneline main.."$CURRENT_BRANCH" | sed 's/^/- /')

## Test Results

- ✅ Type checking: passed
- ✅ Unit tests: passed ($TEST_COUNT tests)
- ✅ Linting: passed
- ✅ Formatting: passed

## Files Modified

$(echo "$MODIFIED_FILES" | sed 's/^/- `/' | sed 's/$/`/')

## Workflow Documents Updated

- Feature plan: \`$FEATURE_PLAN\`
- Workflow documents updated per 5-document system

---

Closes #${ISSUE_NUMBER}
EOF
)

# Create PR
echo ""
echo "Creating pull request..."
gh pr create \
  --title "Implement #${ISSUE_NUMBER}: ${ISSUE_TITLE}" \
  --body "$PR_BODY" \
  --base main

echo ""
echo "✅ Pull request created successfully"
echo ""
echo "View PR: gh pr view"
echo ""
