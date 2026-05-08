#!/bin/bash
# Create worktree for GitHub issue implementation

set -e

ISSUE_NUMBER=$1
ISSUE_TITLE=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$ISSUE_TITLE" ]; then
  echo "Usage: $0 <issue-number> <issue-title>"
  exit 1
fi

# Create slug from title (lowercase, replace non-alphanumeric with hyphens)
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

# Truncate slug if too long (max 50 chars)
SLUG=${SLUG:0:50}
SLUG=$(echo "$SLUG" | sed 's/-$//')

# Branch and worktree names
BRANCH="feature/issue-${ISSUE_NUMBER}-${SLUG}"
WORKTREE_PATH=".worktrees/issue-${ISSUE_NUMBER}-${SLUG}"

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
  echo "Error: Worktree already exists at $WORKTREE_PATH"
  echo "Use cleanup-issue-worktree.sh to remove it first"
  exit 1
fi

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Warning: Branch $BRANCH already exists"
  echo "Creating worktree from existing branch"
  git worktree add "$WORKTREE_PATH" "$BRANCH"
else
  echo "Creating new branch and worktree"
  git worktree add -b "$BRANCH" "$WORKTREE_PATH" main
fi

echo ""
echo "✅ Worktree created successfully"
echo "   Path: $WORKTREE_PATH"
echo "   Branch: $BRANCH"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_PATH"
echo "  npm ci"
echo ""
