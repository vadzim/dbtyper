#!/bin/bash
# Cleanup worktree after issue implementation

set -e

ISSUE_NUMBER=$1
ISSUE_TITLE=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$ISSUE_TITLE" ]; then
  echo "Usage: $0 <issue-number> <issue-title>"
  exit 1
fi

# Create slug from title
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
SLUG=${SLUG:0:50}
SLUG=$(echo "$SLUG" | sed 's/-$//')

WORKTREE_PATH=".worktrees/issue-${ISSUE_NUMBER}-${SLUG}"
BRANCH="feature/issue-${ISSUE_NUMBER}-${SLUG}"

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "Warning: Worktree not found at $WORKTREE_PATH"
else
  echo "Removing worktree: $WORKTREE_PATH"
  git worktree remove "$WORKTREE_PATH" --force
  echo "✅ Worktree removed"
fi

# Check if branch exists and is merged
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  # Check if branch is merged into main
  if git branch --merged main | grep -q "$BRANCH"; then
    echo "Deleting merged branch: $BRANCH"
    git branch -d "$BRANCH"
    echo "✅ Branch deleted"
  else
    echo "⚠️  Branch $BRANCH is not merged into main"
    echo "   Use 'git branch -D $BRANCH' to force delete if needed"
  fi
else
  echo "Branch $BRANCH does not exist (already deleted)"
fi

# Remove lock file if exists
LOCK_FILE=".automation/.processing/issue-${ISSUE_NUMBER}.lock"
if [ -f "$LOCK_FILE" ]; then
  rm "$LOCK_FILE"
  echo "✅ Lock file removed"
fi

echo ""
echo "Cleanup complete for issue #$ISSUE_NUMBER"
echo ""
