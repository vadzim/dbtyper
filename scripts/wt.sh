#!/usr/bin/env bash
set -e

# Usage: wt <branch-name>
# Creates a worktree in .worktrees/<branch-name> if it doesn't exist
# Always prints the path for use with cd $(wt <name>)

if [ -z "$1" ]; then
	echo "Usage: wt <branch-name>" >&2
	exit 1
fi

BRANCH_NAME="$1"
WORKTREE_DIR=".worktrees/$BRANCH_NAME"

# Check if worktree directory already exists
if [ ! -d "$WORKTREE_DIR" ]; then
	# Create worktree from dev branch
	git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" dev
fi

# Print the path (for cd command)
echo "$WORKTREE_DIR"
