# GitHub Label Monitor Feature Status

**Date:** 2026-05-08 10:40  
**Current State:** In Progress

**CRITICAL: Before working on this feature, you MUST read .workflow/ folder:**

1. **FIRST:** Read `.workflow/README.md` - Workflow instructions and guidelines
2. **SECOND:** Read `.workflow/findings.md` - General development patterns and techniques
3. **THIRD:** Read `.workflow/project_knowledge.md` - Project-specific conventions and knowledge
4. **FOURTH:** Read `.workflow/feature_template.md` - Template structure

**This applies whether you are starting, resuming, or reviewing this feature.**

**Part of the 5-document system:**

1. .workflow/README.md - Workflow instructions
2. .workflow/findings.md - General development findings
3. .workflow/project_knowledge.md - Project-specific knowledge
4. .workflow/feature_template.md - Template for new features
5. .features/2026-05-08-1040-github-label-monitor.md - Current feature plan (THIS FILE)

---

## Overview

Create a script that monitors GitHub issue labels and automatically starts implementation scripts when specific labels are detected. The system should support:

1. **Concurrent implementation control** - Command-line parameter to limit simultaneous feature implementations (default: 1)
2. **Two monitoring modes:**
    - Polling mode: Check GitHub API every 30 seconds
    - Webhook mode: Real-time updates via smee.io
3. **Integration with existing workflow** - Use the automated-issue-implementation.md workflow

---

## Requirements

### Core Functionality

1. **Label Monitoring**
    - Monitor GitHub issues for label changes
    - Detect when "approved" label is added
    - Track which issues are already being processed

2. **Concurrency Control**
    - CLI parameter: `--max-concurrent <number>` (default: 1)
    - Track active implementations
    - Queue new issues when at capacity
    - Start queued issues when slots become available

3. **Two Monitoring Modes**
    - **Polling mode** (default):
        - Poll GitHub API every 30 seconds
        - Compare current state with previous state
        - Detect label additions/removals
    - **Webhook mode** (via smee.io):
        - Real-time webhook events
        - Instant reaction to label changes
        - Requires smee.io channel URL

4. **Implementation Triggering**
    - When "approved" label detected, start implementation
    - Use existing `.workflow/automated-issue-implementation.md` process
    - Create worktree in `.worktrees/issue-{number}-{slug}/`
    - Launch AI agent for implementation

---

## Technical Design

### File Structure

```
scripts/
  monitor-github-labels.ts       # Main monitoring script
  github-label-monitor/
    polling-monitor.ts            # Polling implementation
    webhook-monitor.ts            # Webhook implementation
    implementation-queue.ts       # Queue and concurrency control
    github-api.ts                 # GitHub API client
    types.ts                      # TypeScript types
```

### CLI Interface

```bash
# Polling mode (default)
npm run monitor-labels

# Polling mode with concurrency
npm run monitor-labels -- --max-concurrent 3

# Webhook mode
npm run monitor-labels -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

# Webhook mode with concurrency
npm run monitor-labels -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL --max-concurrent 2
```

### Configuration

Environment variables:

- `GITHUB_TOKEN` - GitHub personal access token (required)
- `GITHUB_REPO` - Repository in format "owner/repo" (required)
- `POLL_INTERVAL_MS` - Polling interval in milliseconds (default: 30000)

---

## Implementation Plan

### Phase 1: Core Infrastructure

**Goal:** Set up basic structure and GitHub API client

#### Step 1.1: Project Setup

- [ ] Create `scripts/github-label-monitor/` directory
- [ ] Add TypeScript types for GitHub API responses
- [ ] Create GitHub API client with authentication
- [ ] Add configuration loading from environment variables

#### Step 1.2: Implementation Queue

- [ ] Create queue data structure for pending issues
- [ ] Implement concurrency tracking (active implementations)
- [ ] Add methods: `canStart()`, `startImplementation()`, `completeImplementation()`
- [ ] Handle queue processing when slots become available

### Phase 2: Polling Monitor

**Goal:** Implement polling-based label monitoring

#### Step 2.1: Polling Logic

- [ ] Fetch open issues from GitHub API
- [ ] Track known label state (issue_number → labels[])
- [ ] Detect label additions and removals
- [ ] Emit events for label changes

#### Step 2.2: Integration with Queue

- [ ] When "approved" label detected, add to queue
- [ ] Start implementation if capacity available
- [ ] Handle errors and retries

#### Step 2.3: Testing

- [ ] Test polling with mock GitHub API
- [ ] Test label change detection
- [ ] Test queue integration

### Phase 3: Webhook Monitor

**Goal:** Implement webhook-based monitoring via smee.io

#### Step 3.1: Webhook Server

- [ ] Create Express server to receive webhooks
- [ ] Parse GitHub webhook payloads
- [ ] Handle "labeled" and "unlabeled" events
- [ ] Validate webhook signatures (optional)

#### Step 3.2: Smee.io Integration

- [ ] Document smee.io setup process
- [ ] Handle webhook events from smee.io proxy
- [ ] Emit events for label changes

#### Step 3.3: Integration with Queue

- [ ] When "approved" label detected, add to queue
- [ ] Start implementation if capacity available
- [ ] Handle errors and retries

### Phase 4: Implementation Triggering

**Goal:** Launch implementation process when issues are approved

#### Step 4.1: Worktree Creation

- [ ] Generate branch name from issue number and title
- [ ] Create worktree in `.worktrees/issue-{number}-{slug}/`
- [ ] Handle worktree creation errors

#### Step 4.2: AI Agent Integration

- [ ] Read issue details from GitHub API
- [ ] Extract title, body, acceptance criteria
- [ ] Launch AI agent with issue context
- [ ] Follow `.workflow/automated-issue-implementation.md` process

#### Step 4.3: Completion Handling

- [ ] Detect when implementation completes
- [ ] Mark implementation as complete in queue
- [ ] Start next queued issue if available
- [ ] Clean up on errors

### Phase 5: CLI and Main Script

**Goal:** Create user-friendly CLI interface

#### Step 5.1: CLI Argument Parsing

- [ ] Parse `--mode` (polling/webhook)
- [ ] Parse `--max-concurrent <number>`
- [ ] Parse `--smee-url <url>` for webhook mode
- [ ] Validate arguments

#### Step 5.2: Main Script

- [ ] Load configuration from environment
- [ ] Initialize appropriate monitor (polling/webhook)
- [ ] Initialize implementation queue
- [ ] Start monitoring
- [ ] Handle graceful shutdown (Ctrl+C)

#### Step 5.3: Logging and Monitoring

- [ ] Log when issues are detected
- [ ] Log when implementations start/complete
- [ ] Log queue status
- [ ] Log errors with context

### Phase 6: Documentation and Testing

**Goal:** Document usage and test the system

#### Step 6.1: Documentation

- [ ] Create README for the monitoring system
- [ ] Document setup process (GitHub token, smee.io)
- [ ] Document CLI usage and examples
- [ ] Add troubleshooting section

#### Step 6.2: Testing

- [ ] Test polling mode with real GitHub API
- [ ] Test webhook mode with smee.io
- [ ] Test concurrency control (multiple issues)
- [ ] Test error handling and recovery

#### Step 6.3: Integration

- [ ] Add npm script: `monitor-labels`
- [ ] Update main project documentation
- [ ] Add to `.workflow/automated-issue-implementation.md`

---

## Success Criteria

- [ ] Script monitors GitHub issues for label changes
- [ ] Polling mode works (30-second interval)
- [ ] Webhook mode works (via smee.io)
- [ ] Concurrency control limits simultaneous implementations
- [ ] Queue processes pending issues when slots available
- [ ] Implementation process launches correctly
- [ ] CLI interface is user-friendly
- [ ] Documentation is complete and clear
- [ ] Error handling is robust

---

## Technical Challenges

### Challenge 1: Concurrency Control

**Problem:** Managing multiple simultaneous implementations without conflicts

**Solution:**

- Use a queue with capacity tracking
- Each implementation gets isolated worktree
- Track active implementations by issue number
- Process queue when implementations complete

### Challenge 2: State Persistence

**Problem:** Remembering which issues are being processed across restarts

**Solution:**

- Check for existing worktrees on startup
- Resume tracking active implementations
- Option: Use lock files in `.processing/` directory

### Challenge 3: AI Agent Integration

**Problem:** Launching and monitoring AI agent processes

**Solution:**

- Use child_process to spawn implementation script
- Pass issue context via command-line arguments or stdin
- Monitor process completion via exit codes
- Handle agent failures gracefully

---

## Timeline Estimate

- **Phase 1:** 1-2 hours (infrastructure setup)
- **Phase 2:** 1-2 hours (polling monitor)
- **Phase 3:** 1-2 hours (webhook monitor)
- **Phase 4:** 2-3 hours (implementation triggering)
- **Phase 5:** 1 hour (CLI and main script)
- **Phase 6:** 1 hour (documentation and testing)

**Total:** 7-11 hours of focused work

---

## Progress Tracking

**Started:** 2026-05-08 10:40  
**Last Updated:** 2026-05-08 10:40  
**Status:** 🔄 Planning

**Next Steps:**

1. Launch planning subagent to research codebase and refine plan
2. Review and refine plan based on subagent findings
3. Begin Phase 1 implementation

---

## Notes

- This feature integrates with existing `.workflow/automated-issue-implementation.md`
- Uses git worktrees for isolation (same pattern as existing workflow)
- Supports both polling (simple) and webhooks (real-time)
- Concurrency control prevents overwhelming the system
- Can be extended to support other labels beyond "approved"
