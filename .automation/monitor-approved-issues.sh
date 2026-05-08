#!/bin/bash
# Monitor GitHub issues for "approved" label and trigger implementation

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load configuration
CONFIG_FILE="$SCRIPT_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Warning: config.json not found, using defaults"
  CHECK_INTERVAL=300
  MAX_PARALLEL=3
else
  CHECK_INTERVAL=$(jq -r '.automation.checkInterval // 300' "$CONFIG_FILE")
  MAX_PARALLEL=$(jq -r '.automation.maxParallelImplementations // 3' "$CONFIG_FILE")
fi

echo "Starting issue monitor..."
echo "Check interval: ${CHECK_INTERVAL}s"
echo "Max parallel implementations: $MAX_PARALLEL"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  exit 1
fi

# Main monitoring loop
while true; do
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Checking for approved issues..."
  
  # Get all open issues with "approved" label
  APPROVED_ISSUES=$(gh issue list --label approved --state open --json number --jq '.[].number' 2>/dev/null || echo "")
  
  if [ -z "$APPROVED_ISSUES" ]; then
    echo "No approved issues found"
  else
    echo "Found approved issues: $APPROVED_ISSUES"
    
    # Count currently processing issues
    PROCESSING_COUNT=$(ls "$SCRIPT_DIR/.processing/"*.lock 2>/dev/null | wc -l)
    
    for ISSUE_NUMBER in $APPROVED_ISSUES; do
      # Check if already being processed
      LOCK_FILE="$SCRIPT_DIR/.processing/issue-${ISSUE_NUMBER}.lock"
      
      if [ -f "$LOCK_FILE" ]; then
        echo "  Issue #$ISSUE_NUMBER: already processing (lock file exists)"
        continue
      fi
      
      # Check if we've reached max parallel implementations
      if [ "$PROCESSING_COUNT" -ge "$MAX_PARALLEL" ]; then
        echo "  Issue #$ISSUE_NUMBER: skipping (max parallel limit reached: $MAX_PARALLEL)"
        continue
      fi
      
      echo "  Issue #$ISSUE_NUMBER: starting implementation..."
      
      # Start implementation in background
      (
        bash "$SCRIPT_DIR/auto-implement-issue.sh" "$ISSUE_NUMBER"
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
          echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Issue #$ISSUE_NUMBER: implementation completed"
        else
          echo "[$(date +%Y-%m-%d\ %H:%M:%S)] Issue #$ISSUE_NUMBER: implementation failed (exit code: $EXIT_CODE)"
          # Remove lock file on failure
          rm -f "$SCRIPT_DIR/.processing/issue-${ISSUE_NUMBER}.lock"
        fi
      ) &
      
      PROCESSING_COUNT=$((PROCESSING_COUNT + 1))
    done
  fi
  
  echo "Waiting ${CHECK_INTERVAL}s before next check..."
  echo ""
  sleep "$CHECK_INTERVAL"
done
