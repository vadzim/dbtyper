#!/bin/bash
# Main orchestrator for automated issue implementation

set -e

ISSUE_NUMBER=$1

if [ -z "$ISSUE_NUMBER" ]; then
  echo "Usage: $0 <issue-number>"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Create log file
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/issue-${ISSUE_NUMBER}-$(date +%Y%m%d-%H%M%S).log"

# Log function
log() {
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $*" | tee -a "$LOG_FILE"
}

log "Starting automated implementation for issue #$ISSUE_NUMBER"

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  log "Error: GitHub CLI (gh) is not installed"
  exit 1
fi

# Fetch issue details
log "Fetching issue details from GitHub..."
ISSUE_JSON=$(gh issue view "$ISSUE_NUMBER" --json title,body,labels,state)

if [ -z "$ISSUE_JSON" ]; then
  log "Error: Could not fetch issue #$ISSUE_NUMBER"
  exit 1
fi

ISSUE_TITLE=$(echo "$ISSUE_JSON" | jq -r '.title')
ISSUE_BODY=$(echo "$ISSUE_JSON" | jq -r '.body')
ISSUE_STATE=$(echo "$ISSUE_JSON" | jq -r '.state')
LABELS=$(echo "$ISSUE_JSON" | jq -r '.labels[].name')

log "Issue: #$ISSUE_NUMBER - $ISSUE_TITLE"
log "State: $ISSUE_STATE"
log "Labels: $LABELS"

# Verify issue is open
if [ "$ISSUE_STATE" != "OPEN" ]; then
  log "Error: Issue #$ISSUE_NUMBER is not open (state: $ISSUE_STATE)"
  exit 1
fi

# Verify "approved" label exists
if ! echo "$LABELS" | grep -q "approved"; then
  log "Error: Issue #$ISSUE_NUMBER does not have 'approved' label"
  log "Available labels: $LABELS"
  exit 1
fi

log "✅ Issue is approved and ready for implementation"

# Add "in-progress" label to indicate implementation has started
log "Adding 'in-progress' label..."
gh issue edit "$ISSUE_NUMBER" --add-label "in-progress" 2>&1 | tee -a "$LOG_FILE"

# Create lock file to prevent duplicate processing
LOCK_FILE="$SCRIPT_DIR/.processing/issue-${ISSUE_NUMBER}.lock"
mkdir -p "$SCRIPT_DIR/.processing"

if [ -f "$LOCK_FILE" ]; then
  log "Warning: Lock file exists, issue may already be processing"
  log "Lock file: $LOCK_FILE"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "$(date +%s)" > "$LOCK_FILE"
log "Created lock file: $LOCK_FILE"

# Create worktree
log "Creating worktree..."
cd "$PROJECT_ROOT"
bash "$SCRIPT_DIR/create-issue-worktree.sh" "$ISSUE_NUMBER" "$ISSUE_TITLE" 2>&1 | tee -a "$LOG_FILE"

# Get worktree path
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
SLUG=${SLUG:0:50}
SLUG=$(echo "$SLUG" | sed 's/-$//')
WORKTREE_PATH="$PROJECT_ROOT/.worktrees/issue-${ISSUE_NUMBER}-${SLUG}"

if [ ! -d "$WORKTREE_PATH" ]; then
  log "Error: Worktree was not created at $WORKTREE_PATH"
  rm "$LOCK_FILE"
  exit 1
fi

# Change to worktree
log "Changing to worktree: $WORKTREE_PATH"
cd "$WORKTREE_PATH"

# Install dependencies
log "Installing dependencies..."
npm ci 2>&1 | tee -a "$LOG_FILE"

log "✅ Worktree setup complete"

# Save issue details for AI agent
ISSUE_FILE="$WORKTREE_PATH/.issue-${ISSUE_NUMBER}.json"
echo "$ISSUE_JSON" > "$ISSUE_FILE"
log "Issue details saved to: $ISSUE_FILE"

# Generate AI agent prompt from template
log ""
log "=========================================="
log "AI AGENT IMPLEMENTATION PHASE"
log "=========================================="
log ""
log "Generating prompt for OpenCode..."

# Read prompt template
PROMPT_TEMPLATE=$(cat "$SCRIPT_DIR/agent-prompt-template.md")

# Replace variables in template
AGENT_PROMPT=$(echo "$PROMPT_TEMPLATE" | sed "s/{ISSUE_NUMBER}/$ISSUE_NUMBER/g" | sed "s/{ISSUE_TITLE}/$ISSUE_TITLE/g" | sed "s/{SLUG}/$SLUG/g")

# Append issue body to prompt
AGENT_PROMPT="$AGENT_PROMPT

---

## Issue Body

$ISSUE_BODY
"

# Save prompt to file for reference
PROMPT_FILE="$WORKTREE_PATH/.agent-prompt-issue-${ISSUE_NUMBER}.md"
echo "$AGENT_PROMPT" > "$PROMPT_FILE"
log "Agent prompt saved to: $PROMPT_FILE"

# Check if opencode is available
if ! command -v opencode &> /dev/null; then
  log "Error: OpenCode is not installed or not in PATH"
  log "Please install OpenCode or run implementation manually"
  log ""
  log "Manual implementation:"
  log "   cd $WORKTREE_PATH"
  log "   Read the prompt in: $PROMPT_FILE"
  log "   Follow the instructions to implement the feature"
  log ""
  rm "$LOCK_FILE"
  exit 1
fi

log "Launching OpenCode in autonomous mode..."
log "Working directory: $WORKTREE_PATH"
log ""

# Launch OpenCode with the prompt in autonomous mode
# --dangerously-skip-permissions: auto-approve permissions for fully autonomous operation
# --title: set session title
# --format json: get structured output for parsing
opencode run \
  --dir "$WORKTREE_PATH" \
  --title "Issue #${ISSUE_NUMBER}: ${ISSUE_TITLE}" \
  --dangerously-skip-permissions \
  "$AGENT_PROMPT" 2>&1 | tee -a "$LOG_FILE"

OPENCODE_EXIT_CODE=${PIPESTATUS[0]}

log ""
log "=========================================="
log "OpenCode execution completed"
log "Exit code: $OPENCODE_EXIT_CODE"
log "=========================================="
log ""

if [ $OPENCODE_EXIT_CODE -ne 0 ]; then
  log "Error: OpenCode execution failed with exit code $OPENCODE_EXIT_CODE"
  log "Check log file for details: $LOG_FILE"
  log ""
  log "You can continue manually:"
  log "   cd $WORKTREE_PATH"
  log "   Review the work done so far"
  log "   Complete the implementation"
  log "   bash $SCRIPT_DIR/create-issue-pr.sh $ISSUE_NUMBER \"$ISSUE_TITLE\""
  log ""
  
  # Remove "in-progress" label on failure
  log "Removing 'in-progress' label..."
  gh issue edit "$ISSUE_NUMBER" --remove-label "in-progress" 2>&1 | tee -a "$LOG_FILE"
  
  rm "$LOCK_FILE"
  exit 1
fi

# Verify implementation completed successfully
log "Verifying implementation..."

# Check if feature plan was created
FEATURE_PLAN=$(ls "$WORKTREE_PATH/.features/"*-issue-${ISSUE_NUMBER}-*.md 2>/dev/null | head -n 1)
if [ -z "$FEATURE_PLAN" ]; then
  log "Warning: Feature plan not found in .features/"
  log "Implementation may be incomplete"
fi

# Check if there are uncommitted changes
cd "$WORKTREE_PATH"
if ! git diff-index --quiet HEAD --; then
  log "Warning: Uncommitted changes detected"
  log "OpenCode may not have committed all changes"
  log ""
  log "Committing remaining changes..."
  git add .
  git commit -m "Complete implementation of issue #${ISSUE_NUMBER}" || log "No changes to commit"
fi

# Run final test suite
log ""
log "Running final test suite..."
if npm run test:ci 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ All tests passed"
else
  log "⚠️  Tests failed"
  log "Implementation may need manual fixes"
  log ""
  log "To fix and create PR:"
  log "   cd $WORKTREE_PATH"
  log "   Fix test failures"
  log "   npm run test:ci"
  log "   bash $SCRIPT_DIR/create-issue-pr.sh $ISSUE_NUMBER \"$ISSUE_TITLE\""
  log ""
  
  # Remove "in-progress" label on test failure
  log "Removing 'in-progress' label..."
  gh issue edit "$ISSUE_NUMBER" --remove-label "in-progress" 2>&1 | tee -a "$LOG_FILE"
  
  rm "$LOCK_FILE"
  exit 1
fi

# Create pull request
log ""
log "Creating pull request..."
bash "$SCRIPT_DIR/create-issue-pr.sh" "$ISSUE_NUMBER" "$ISSUE_TITLE" 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
  log "✅ Pull request created successfully"
  
  # Remove "in-progress" label since PR is created
  log "Removing 'in-progress' label..."
  gh issue edit "$ISSUE_NUMBER" --remove-label "in-progress" 2>&1 | tee -a "$LOG_FILE"
else
  log "Error: Failed to create pull request"
  log "You can create it manually:"
  log "   cd $WORKTREE_PATH"
  log "   bash $SCRIPT_DIR/create-issue-pr.sh $ISSUE_NUMBER \"$ISSUE_TITLE\""
  
  # Remove "in-progress" label on failure
  log "Removing 'in-progress' label..."
  gh issue edit "$ISSUE_NUMBER" --remove-label "in-progress" 2>&1 | tee -a "$LOG_FILE"
  
  rm "$LOCK_FILE"
  exit 1
fi

# Clean up lock file
rm "$LOCK_FILE"
log "Removed lock file"

log ""
log "=========================================="
log "IMPLEMENTATION COMPLETE"
log "=========================================="
log ""
log "Issue #$ISSUE_NUMBER has been implemented and a PR has been created"
log "Log file: $LOG_FILE"
log ""
log "Next steps:"
log "1. Review the PR on GitHub"
log "2. Maintainer reviews and approves"
log "3. Merge the PR"
log "4. Clean up worktree: bash $SCRIPT_DIR/cleanup-issue-worktree.sh $ISSUE_NUMBER \"$ISSUE_TITLE\""
log ""

exit 0
