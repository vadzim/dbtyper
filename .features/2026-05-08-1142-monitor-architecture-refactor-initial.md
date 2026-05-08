# Monitor Architecture Refactor - Initial Plan

**Date:** 2026-05-08 11:42  
**Branch:** feature/monitor-architecture-refactor  
**Worktree:** .worktrees/monitor-architecture-refactor

## What User Requested

Refactor the GitHub label monitor to have a better architecture:

### 1. Automatic Setup on Startup

- Create smee.io URL automatically (no manual setup needed)
- Configure GitHub webhook automatically
- Cleanup old smee webhooks from GitHub on startup
- Remove GitHub webhook on shutdown (clean exit)

### 2. Startup Issue Scan

- On startup, scan for issues that are "approved" but NOT "in-progress"
- Add these to the work queue immediately
- Don't miss issues that were approved while monitor was down

### 3. Single Event Loop Architecture

- One central message loop/event queue
- All events go through this single entry point:
    - Startup scan results → messages
    - Webhook events → messages
    - Poller events → messages
    - Worker completion → messages
- Loop decides: start worker if under limit, or queue
- No race conditions, single source of truth

### 4. Worker Communication

- When worker finishes, it sends message back to loop
- Loop processes completion and starts next queued issue
- Clean message-passing architecture

## Benefits

- **Restartable:** Scans on startup, doesn't miss issues
- **Clean shutdown:** Removes webhooks automatically
- **No manual setup:** Creates smee URL automatically
- **Better architecture:** Single event loop, no race conditions
- **Easier to reason about:** All events go to one place

## Next Steps

1. Read all .workflow/ documents
2. Create detailed feature plan
3. Implement the refactoring
4. Test thoroughly
5. Update documentation
