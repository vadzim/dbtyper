#!/bin/bash
set -e

# Script to create a pull request with auto-merge enabled
# Usage: ./scripts/create-pr.sh "PR title" "PR body (optional)"

TITLE="$1"
BODY="${2:-}"

if [ -z "$TITLE" ]; then
  echo "Error: PR title is required"
  echo "Usage: $0 \"PR title\" \"PR body (optional)\""
  exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "Error: Cannot create PR from main branch"
  exit 1
fi

# Push current branch to remote
echo "Pushing branch to remote..."
git push -u origin "$CURRENT_BRANCH"

# Create PR with auto-merge enabled
echo "Creating pull request..."
if [ -n "$BODY" ]; then
  gh pr create --title "$TITLE" --body "$BODY" --base main
else
  gh pr create --title "$TITLE" --base main
fi

# Enable auto-merge
echo "Enabling auto-merge..."
gh pr merge --auto --merge

echo "✓ Pull request created with auto-merge enabled"
