# Monitor Architecture Refactor Status

**Date:** 2026-05-08 11:42  
**Current State:** Not Started

**If this feature is marked as COMPLETE:**
- An agent resuming this feature should tell you it's complete
- Agent should ask: "This feature is complete. What would you like me to do?"
- Agent should NOT start working without your instruction
- You might want to: review it, test it, add something, or start a new feature

**This is a feature plan document. Saved in `.features/` folder as `2026-05-08-1142-monitor-architecture-refactor.md`**

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
5. .features/2026-05-08-1142-monitor-architecture-refactor.md - Current feature plan (THIS FILE)

---

## Overview

Refactor the GitHub label monitor (`.automation/monitor-github-labels.ts`) to implement a robust, production-ready architecture with automatic setup, startup scanning, and a single event loop pattern.

**Current Problems:**
- Manual setup required (`npm run monitor:setup` to create smee URL and configure webhook)
- No startup scan - misses issues approved while monitor was down
- Webhook not cleaned up on shutdown - leaves orphaned webhooks in GitHub
- No cleanup of old smee webhooks on startup
- Dual architecture (polling vs webhook) with separate code paths
- Worker completion doesn't feed back into the queue properly
- Potential race conditions between different event sources

**Goals:**
1. **Zero-config startup** - Automatically create smee URL and configure GitHub webhook
2. **Restartable** - Scan for missed issues on startup (approved but not in-progress)
3. **Clean shutdown** - Remove GitHub webhook on SIGINT/SIGTERM
4. **Single event loop** - All events (startup scan, webhooks, polling, worker completion) go through one queue
5. **No race conditions** - Single source of truth for queue state and worker management
6. **Better maintainability** - Easier to reason about, test, and extend

---

## Current Architecture vs New Architecture

### Current Architecture (`.automation/monitor-github-labels.ts:1-592`)

**Structure:**
- Two separate monitor classes: `PollingMonitor` and `WebhookMonitor`
- `ImplementationQueue` manages queue and worker spawning
- Lock files in `.processing/` directory track active workers
- Workers spawned with `detached: true` and `stdio: "ignore"`
- Worker completion detected via `proc.on("exit")` event

**Issues:**
1. **Manual setup:** User must run `npm run monitor:setup` separately
2. **No startup scan:** Doesn't check for issues approved while monitor was down
3. **No cleanup:** Webhook left in GitHub after shutdown
4. **Worker completion:** Uses `proc.on("exit")` but worker is detached, so this may not fire reliably
5. **Multiple event sources:** Polling and webhook events handled separately
6. **Race conditions possible:** Queue processing triggered from multiple places

### New Architecture (Event Loop Pattern)

**Core Concept: Single Event Loop**

```
┌─────────────────────────────────────────────────────────┐
│                    Event Loop                           │
│  (Single message queue, processes one event at a time)  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ Startup │     │ Webhook │     │ Worker  │
    │  Scan   │     │ Events  │     │Complete │
    └─────────┘     └─────────┘     └─────────┘
         │                │                │
         └────────────────┴────────────────┘
                All produce messages
```

**Components:**

1. **EventLoop** - Central message queue
   - Processes events one at a time (no race conditions)
   - Decides: start worker or queue issue
   - Tracks active workers and queue state
   - Single source of truth

2. **StartupScanner** - Scans on startup
   - Fetches issues with "approved" label
   - Filters out issues with "in-progress" label
   - Sends messages to event loop for each issue

3. **WebhookReceiver** - Receives GitHub webhooks
   - Listens on HTTP port
   - Parses webhook payload
   - Sends messages to event loop

4. **WorkerManager** - Manages worker processes
   - Spawns workers with IPC channel
   - Receives completion messages from workers
   - Sends completion messages to event loop

5. **SetupManager** - Automatic setup/cleanup
   - Creates smee.io URL on startup
   - Configures GitHub webhook on startup
   - Cleans up old smee webhooks on startup
   - Removes GitHub webhook on shutdown

**Message Types:**

```typescript
type EventMessage =
  | { type: "issue_approved"; issue: Issue }
  | { type: "worker_completed"; issueNumber: number; success: boolean }
  | { type: "worker_failed"; issueNumber: number; error: string }
```

**Benefits:**
- Single point of control (event loop)
- No race conditions (sequential processing)
- Easy to test (inject messages)
- Easy to extend (add new message types)
- Clear data flow (all events → loop → decision)

---

## Migration Status

### ✅ Completed (Working)

None yet - feature not started.

### ❌ Incomplete (Needs Implementation)

1. **Automatic Setup** (`.automation/monitor-github-labels.ts`)
   - **Problem:** Manual setup required, no cleanup
   - **Impact:** User must run separate command, webhooks left orphaned
   - **Proper fix needed:** Implement `SetupManager` class

2. **Startup Scan** (`.automation/monitor-github-labels.ts`)
   - **Problem:** No scan on startup
   - **Impact:** Misses issues approved while monitor was down
   - **Proper fix needed:** Implement `StartupScanner` class

3. **Event Loop Architecture** (`.automation/monitor-github-labels.ts`)
   - **Problem:** Multiple event sources, potential race conditions
   - **Impact:** Hard to reason about, potential bugs
   - **Proper fix needed:** Implement `EventLoop` class

4. **Worker Communication** (`.automation/monitor-github-labels.ts`)
   - **Problem:** Worker completion uses `proc.on("exit")` with detached process
   - **Impact:** May not receive completion events reliably
   - **Proper fix needed:** Implement IPC-based communication

---

## What Needs to Be Done

### Priority 1: Event Loop Core

**Goal:** Implement the central event loop that processes all events sequentially

**Files to update:**
- `.automation/monitor-github-labels.ts` (main refactoring)
  - Add `EventMessage` type union
  - Add `EventLoop` class with message queue
  - Implement `processMessage()` method
  - Implement `canStartWorker()` check
  - Implement `startWorker()` method
  - Implement `enqueueIssue()` method

**Approach:**
1. Define message types (TypeScript union type)
2. Create `EventLoop` class with message queue (array)
3. Implement `enqueue(message: EventMessage)` method
4. Implement `processQueue()` method (async loop)
5. Implement decision logic: start worker or queue issue
6. Add state tracking: active workers, queued issues

**Estimated effort:** 2-3 hours

### Priority 2: Worker Communication

**Goal:** Implement reliable worker completion messages using IPC

**Why this is important:**
- Current approach uses `proc.on("exit")` with detached process
- Detached processes may not fire exit events reliably
- Need explicit message passing from worker to parent
- Allows worker to send structured completion data

**Files to update:**
- `.automation/monitor-github-labels.ts`
  - Modify `startWorker()` to use IPC channel
  - Add message handler for worker completion
  - Remove `detached: true` option
- `.automation/auto-implement-issue.sh`
  - Add completion message at end of script
  - Send JSON message to parent process via stdout

**Approach:**
1. Change worker spawn to use `stdio: ['ignore', 'pipe', 'inherit']`
2. Parse JSON messages from worker stdout
3. Worker sends: `{"type": "completion", "success": true, "issueNumber": 123}`
4. Parent receives message and sends to event loop
5. Remove `detached: true` to ensure proper cleanup

**Estimated effort:** 2-3 hours

### Priority 3: Automatic Setup

**Goal:** Automatically create smee URL, configure webhook, and cleanup on shutdown

**Files to update:**
- `.automation/monitor-github-labels.ts`
  - Add `SetupManager` class
  - Implement `createSmeeUrl()` method
  - Implement `configureGitHubWebhook()` method
  - Implement `cleanupOldWebhooks()` method
  - Implement `removeWebhook()` method
  - Call setup on startup, cleanup on shutdown

**Approach:**
1. Use `smee-client` API to create channel programmatically
2. Use `gh api` to create GitHub webhook
3. Store smee URL in `smee-config.json` for reference
4. On startup: cleanup old webhooks, create new one
5. On shutdown (SIGINT/SIGTERM): remove webhook
6. Handle errors gracefully (network failures, API errors)

**Estimated effort:** 3-4 hours

### Priority 4: Startup Scanner

**Goal:** Scan for approved issues on startup and add to queue

**Files to update:**
- `.automation/monitor-github-labels.ts`
  - Add `StartupScanner` class
  - Implement `scanApprovedIssues()` method
  - Filter out issues with "in-progress" label
  - Send messages to event loop for each issue

**Approach:**
1. Fetch all issues with "approved" label
2. Filter out issues that also have "in-progress" label
3. For each remaining issue, send `issue_approved` message to event loop
4. Run this scan once on startup before starting webhook/polling
5. Log results: "Found X approved issues not yet in progress"

**Estimated effort:** 1-2 hours

---

## Migration Strategy

### Recommended Approach: Incremental Refactoring

1. **Phase 1: Event Loop Core (Priority 1)**
   - Implement `EventLoop` class with message queue
   - Keep existing monitors but route events through loop
   - Test that basic queueing works
   - Verify no regression in existing functionality

2. **Phase 2: Worker Communication (Priority 2)**
   - Implement IPC-based worker communication
   - Modify bash script to send completion messages
   - Test worker completion messages
   - Verify workers complete and send messages correctly

3. **Phase 3: Startup Scanner (Priority 4)**
   - Implement startup scan (easier than setup)
   - Test that approved issues are found and queued
   - Verify "in-progress" filter works correctly

4. **Phase 4: Automatic Setup (Priority 3)**
   - Implement automatic webhook setup/cleanup
   - Test webhook creation and removal
   - Test cleanup of old webhooks
   - Verify graceful shutdown

5. **Phase 5: Integration and Testing**
   - Test full end-to-end flow
   - Test edge cases (network failures, API errors)
   - Test concurrent workers
   - Test restart scenarios

### Alternative Approach: Big Bang Rewrite

1. **Rewrite entire monitor from scratch**
   - Higher risk of introducing bugs
   - Faster if successful
   - Harder to debug if issues arise
   - No incremental testing

**Recommendation:** Use incremental approach. Safer, easier to test, easier to debug.

---

## Technical Challenges

### Challenge 1: Smee.io API

**Problem:** Need to create smee.io channels programmatically, but smee.io doesn't have an official API

**Solution:**
- Option A: Use `smee-client` library directly (check if it exposes channel creation)
- Option B: Make HTTP request to smee.io to create channel
- Option C: Use GitHub's built-in webhook forwarding (if available)
- **Recommended:** Option B - HTTP POST to `https://smee.io/new` returns channel URL

### Challenge 2: Worker Completion Messages

**Problem:** Bash script needs to send structured messages to parent process

**Current state:** Worker spawned with `detached: true` and `stdio: "ignore"`

**Future state:** Worker spawned with `stdio: ['ignore', 'pipe', 'inherit']` and sends JSON to stdout

**Implementation:**
```bash
# At end of auto-implement-issue.sh
echo '{"type":"completion","success":true,"issueNumber":'$ISSUE_NUMBER'}'
```

Parent process parses JSON from stdout and sends to event loop.

### Challenge 3: Race Conditions

**Problem:** Multiple event sources (webhook, polling, worker completion) could trigger queue processing simultaneously

**Solution:** Event loop processes messages sequentially
- All events go into message queue
- Loop processes one message at a time
- No concurrent access to queue state
- Single source of truth

### Challenge 4: Graceful Shutdown

**Problem:** Need to cleanup webhook on shutdown, but workers may still be running

**Solution:**
- On SIGINT/SIGTERM: stop accepting new events
- Wait for active workers to complete (with timeout)
- Remove GitHub webhook
- Exit cleanly

**Implementation:**
```typescript
let shuttingDown = false

process.on("SIGINT", async () => {
  shuttingDown = true
  console.log("Shutting down gracefully...")
  await waitForWorkers(30000) // 30s timeout
  await setupManager.removeWebhook()
  process.exit(0)
})
```

---

## Testing Strategy

1. **Unit tests:**
   - `EventLoop.enqueue()` adds messages to queue
   - `EventLoop.processMessage()` handles each message type correctly
   - `StartupScanner.scanApprovedIssues()` filters correctly
   - `SetupManager.createSmeeUrl()` creates valid URL

2. **Integration tests:**
   - End-to-end: startup → scan → webhook → worker → completion
   - Test with real GitHub issue (create test issue, add label, verify processing)
   - Test restart scenario (stop monitor, approve issue, restart, verify issue processed)
   - Test concurrent workers (approve multiple issues, verify max concurrent respected)

3. **Regression tests:**
   - Existing polling mode still works
   - Existing webhook mode still works
   - Lock files still prevent duplicate processing
   - Queue respects max concurrent limit

4. **Manual tests:**
   - Test graceful shutdown (Ctrl+C removes webhook)
   - Test startup cleanup (old webhooks removed)
   - Test network failures (GitHub API down, smee.io down)
   - Test worker failures (worker crashes, verify completion message sent)

---

## Success Criteria

- [ ] Monitor starts without manual setup (no `npm run monitor:setup` needed)
- [ ] Smee URL created automatically on startup
- [ ] GitHub webhook configured automatically on startup
- [ ] Old smee webhooks cleaned up on startup
- [ ] Startup scan finds approved issues not yet in progress
- [ ] All events (startup, webhook, worker completion) go through event loop
- [ ] Workers send completion messages via IPC
- [ ] Event loop processes messages sequentially (no race conditions)
- [ ] Graceful shutdown removes GitHub webhook
- [ ] Max concurrent workers respected
- [ ] Existing functionality preserved (polling mode, webhook mode)
- [ ] No regression in lock file management
- [ ] Documentation updated (MONITOR-README.md)
- [ ] End-to-end test passes (create issue, approve, verify processing)

---

## Timeline Estimate

- **Priority 1 (Event Loop Core):** 2-3 hours
- **Priority 2 (Worker Communication):** 2-3 hours
- **Priority 3 (Automatic Setup):** 3-4 hours
- **Priority 4 (Startup Scanner):** 1-2 hours
- **Integration & Testing:** 2-3 hours
- **Documentation:** 1 hour

**Total:** 11-16 hours of focused work

---

## Notes

- Keep existing polling mode as fallback (some users may not want webhooks)
- Smee.io channels are free but may have rate limits
- GitHub webhook secret should be generated and stored securely
- Consider adding metrics/logging for monitoring health
- Event loop pattern makes it easy to add new event sources later
- IPC communication is more reliable than relying on process exit events
- Startup scan prevents missing issues during downtime

---

## Current Workarounds (Temporary)

None yet - feature not started.

---

## Related Files

- `.automation/monitor-github-labels.ts` - Main monitor implementation (592 lines)
- `.automation/auto-implement-issue.sh` - Worker script that implements issues (422 lines)
- `.automation/MONITOR-README.md` - Monitor documentation
- `.automation/config.json` - Configuration file
- `.automation/smee-config.json` - Smee URL storage (created by setup)
- `.processing/*.lock` - Lock files for active workers

---

## Detailed TODO Checklist

### Working Rules

**IMPORTANT:** When working on this migration, follow these rules:

1. **Update checkboxes immediately** - Mark `[x]` as soon as a task is completed
   - **CRITICAL: Mark checkboxes [x] IMMEDIATELY after completing each task**
   - **Don't batch updates - update as you go**
   - This makes the plan resumable at any point
2. **Update the plan as you learn** - If you discover new requirements or issues, add them to the plan
3. **Document blockers** - If stuck, add a note explaining what's blocking progress
4. **Keep progress tracking current** - Update the "Last Updated" timestamp and current phase
5. **Make plan resumable** - Any time you stop work, the plan should be clear enough to resume from where you left off
6. **Commit frequently** - Commit the updated plan document after completing each major step
7. **Run tests frequently** - Run `npm test` after completing each significant change to catch issues early
8. **Update knowledge documents** - When you discover something that applies beyond this feature:
   - Project-specific → Update `.workflow/project_knowledge.md`
   - General patterns → Update `.workflow/findings.md`

This ensures the plan is always up-to-date and can be resumed at any time.

---

### Phase 1: Event Loop Core (Priority 1)

**Goal:** Implement central event loop that processes all events sequentially

#### Step 1.1: Define Message Types

- [ ] Add `EventMessage` type union at top of file
- [ ] Define `IssueApprovedMessage` type
- [ ] Define `WorkerCompletedMessage` type
- [ ] Define `WorkerFailedMessage` type

**Notes:** Use TypeScript discriminated union with `type` field

#### Step 1.2: Implement EventLoop Class

- [ ] Create `EventLoop` class
- [ ] Add private `messageQueue: EventMessage[]` field
- [ ] Add private `activeWorkers: Map<number, ChildProcess>` field
- [ ] Add private `queuedIssues: Issue[]` field
- [ ] Add `maxConcurrent: number` field
- [ ] Add `config: Config` field

#### Step 1.3: Implement Queue Methods

- [ ] Implement `enqueue(message: EventMessage): void` method
- [ ] Implement `processQueue(): Promise<void>` method (async loop)
- [ ] Implement `processMessage(message: EventMessage): Promise<void>` method
- [ ] Add logging for each message processed

#### Step 1.4: Implement Decision Logic

- [ ] Implement `canStartWorker(): boolean` method (check active workers < max)
- [ ] Implement `startWorker(issue: Issue): Promise<void>` method
- [ ] Implement `enqueueIssue(issue: Issue): void` method
- [ ] Add logic: if can start, start worker; else enqueue issue

#### Step 1.5: Test Event Loop

- [ ] Test: enqueue message, verify it's processed
- [ ] Test: enqueue multiple messages, verify sequential processing
- [ ] Test: max concurrent limit respected
- [ ] Test: queued issues processed when worker completes

### Phase 2: Worker Communication (Priority 2)

**Goal:** Implement reliable IPC-based worker completion messages

#### Step 2.1: Modify Worker Spawning

- [ ] Change `spawn()` options: remove `detached: true`
- [ ] Change `stdio` to `['ignore', 'pipe', 'inherit']`
- [ ] Add stdout data handler to parse JSON messages
- [ ] Remove `proc.on("exit")` handler (replaced by IPC)

#### Step 2.2: Implement Message Parsing

- [ ] Parse JSON from worker stdout
- [ ] Handle parse errors gracefully
- [ ] Validate message structure
- [ ] Send parsed message to event loop

#### Step 2.3: Modify Bash Script

- [ ] Open `.automation/auto-implement-issue.sh`
- [ ] Add completion message at end: `echo '{"type":"completion","success":true,"issueNumber":'$ISSUE_NUMBER'}'`
- [ ] Add failure message on error: `echo '{"type":"completion","success":false,"issueNumber":'$ISSUE_NUMBER'}'`
- [ ] Test bash script sends messages correctly

#### Step 2.4: Test Worker Communication

- [ ] Test: worker completes successfully, message received
- [ ] Test: worker fails, failure message received
- [ ] Test: message triggers next queued issue to start
- [ ] Test: multiple workers complete, all messages received

### Phase 3: Startup Scanner (Priority 4)

**Goal:** Scan for approved issues on startup and add to queue

#### Step 3.1: Implement StartupScanner Class

- [ ] Create `StartupScanner` class
- [ ] Add `config: Config` field
- [ ] Add `eventLoop: EventLoop` field
- [ ] Implement `scan(): Promise<void>` method

#### Step 3.2: Implement Scan Logic

- [ ] Fetch all issues with "approved" label using `fetchApprovedIssues()`
- [ ] Filter out issues that have "in-progress" label
- [ ] For each remaining issue, send `issue_approved` message to event loop
- [ ] Log results: "Found X approved issues not yet in progress"

#### Step 3.3: Integrate with Main

- [ ] Call `startupScanner.scan()` in `main()` before starting monitors
- [ ] Test: create approved issue, restart monitor, verify issue queued
- [ ] Test: create approved + in-progress issue, verify NOT queued
- [ ] Test: no approved issues, verify no errors

### Phase 4: Automatic Setup (Priority 3)

**Goal:** Automatically create smee URL, configure webhook, cleanup on shutdown

#### Step 4.1: Research Smee.io API

- [ ] Test HTTP POST to `https://smee.io/new` to create channel
- [ ] Verify response contains channel URL
- [ ] Document API behavior

#### Step 4.2: Implement SetupManager Class

- [ ] Create `SetupManager` class
- [ ] Add `config: Config` field
- [ ] Add `smeeUrl: string | null` field
- [ ] Add `webhookId: number | null` field

#### Step 4.3: Implement Smee URL Creation

- [ ] Implement `createSmeeUrl(): Promise<string>` method
- [ ] Make HTTP POST to `https://smee.io/new`
- [ ] Parse response to get channel URL
- [ ] Save URL to `smee-config.json`
- [ ] Return URL

#### Step 4.4: Implement GitHub Webhook Configuration

- [ ] Implement `configureGitHubWebhook(smeeUrl: string): Promise<void>` method
- [ ] Use `gh api` to create webhook: `POST /repos/{owner}/{repo}/hooks`
- [ ] Set webhook URL to smee URL
- [ ] Set events: `["issues"]`
- [ ] Store webhook ID for later removal

#### Step 4.5: Implement Cleanup Methods

- [ ] Implement `cleanupOldWebhooks(): Promise<void>` method
- [ ] Fetch all webhooks: `gh api /repos/{owner}/{repo}/hooks`
- [ ] Find webhooks with smee.io URLs
- [ ] Delete old smee webhooks
- [ ] Implement `removeWebhook(): Promise<void>` method
- [ ] Delete webhook by ID: `gh api -X DELETE /repos/{owner}/{repo}/hooks/{id}`

#### Step 4.6: Integrate with Main

- [ ] Call `setupManager.cleanupOldWebhooks()` on startup
- [ ] Call `setupManager.createSmeeUrl()` on startup
- [ ] Call `setupManager.configureGitHubWebhook()` on startup
- [ ] Call `setupManager.removeWebhook()` on SIGINT/SIGTERM
- [ ] Test: start monitor, verify webhook created
- [ ] Test: stop monitor (Ctrl+C), verify webhook removed
- [ ] Test: restart monitor, verify old webhook cleaned up

### Phase 5: Integration and Testing

**Goal:** Test full end-to-end flow and edge cases

#### Step 5.1: End-to-End Testing

- [ ] Create test GitHub issue
- [ ] Add "approved" label
- [ ] Verify monitor picks it up
- [ ] Verify worker starts
- [ ] Verify worker completes
- [ ] Verify completion message received
- [ ] Verify next queued issue starts (if any)

#### Step 5.2: Restart Scenario Testing

- [ ] Create test issue and approve it
- [ ] Stop monitor (don't start worker)
- [ ] Restart monitor
- [ ] Verify startup scan finds issue
- [ ] Verify issue processed

#### Step 5.3: Concurrent Workers Testing

- [ ] Set max concurrent to 2
- [ ] Approve 3 issues
- [ ] Verify only 2 workers start
- [ ] Verify 3rd issue queued
- [ ] Verify 3rd issue starts when first completes

#### Step 5.4: Edge Cases Testing

- [ ] Test: GitHub API down (network error)
- [ ] Test: Smee.io down (can't create channel)
- [ ] Test: Worker crashes (verify failure message)
- [ ] Test: Invalid webhook payload (verify graceful handling)
- [ ] Test: Duplicate events (verify lock files prevent duplicates)

#### Step 5.5: Run Full Test Suite

- [ ] Run `npm test` - should pass all tests
- [ ] Fix any test failures
- [ ] Verify 0 TypeScript compilation errors

### Phase 6: Cleanup and Documentation (Final)

#### Step 6.1: Code Cleanup

- [ ] Remove old `PollingMonitor` class (if fully replaced)
- [ ] Remove old `WebhookMonitor` class (if fully replaced)
- [ ] Remove any dead code or commented-out sections
- [ ] Add JSDoc comments to new classes and methods
- [ ] Ensure consistent code style

#### Step 6.2: Update Documentation

- [ ] Update `.automation/MONITOR-README.md` with new architecture
- [ ] Document automatic setup feature
- [ ] Document startup scan feature
- [ ] Document event loop architecture
- [ ] Add troubleshooting section
- [ ] Update usage examples

#### Step 6.3: Update Configuration

- [ ] Update `config.json` example if needed
- [ ] Document new configuration options (if any)
- [ ] Update npm scripts in `package.json` if needed

#### Step 6.4: Final Verification

- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck:full` - 0 errors
- [ ] Run `npm run format:check` - no formatting issues
- [ ] Review git diff - changes look correct
- [ ] Test monitor in real environment (not just test issues)

#### Step 6.5: Commit and Document

- [ ] Commit all changes with clear commit message
- [ ] Update this status document with completion date
- [ ] Mark feature as complete

---

## Progress Tracking

**Started:** Not started  
**Last Updated:** 2026-05-08 11:43  
**Status:** 🔄 Planning Complete - Ready for Implementation

**Completed Steps:**

- ✅ Read all 4 workflow documents (completed 2026-05-08 11:43)
- ✅ Read initial plan (completed 2026-05-08 11:43)
- ✅ Read current monitor implementation (completed 2026-05-08 11:43)
- ✅ Created comprehensive feature plan (completed 2026-05-08 11:43)

**Current Status:**

- ✅ Feature plan created with detailed breakdown
- ✅ Architecture designed (event loop pattern)
- ✅ Implementation phases defined
- ✅ Success criteria established

**Next Steps:**

1. Begin Phase 1: Event Loop Core (highest priority)
2. Implement message types and EventLoop class
3. Test event loop with mock messages
4. Move to Phase 2: Worker Communication

**Summary:**

Comprehensive feature plan created for monitor architecture refactor. Plan includes:
- Detailed current vs new architecture comparison
- Event loop pattern design with single message queue
- 6 implementation phases with detailed checklists
- Technical challenges and solutions
- Testing strategy and success criteria
- Estimated 11-16 hours of focused work

Ready to begin implementation.

---

## Workflow Retrospective

**MANDATORY:** After completing this feature, perform a retrospective on your workflow adherence.

**This section must be completed before marking the feature as done.**

### What went well:
- [To be filled after feature completion]

### What could be improved:
- [To be filled after feature completion]
- **CRITICAL checks:**
  - Did I create this feature plan BEFORE starting implementation? [Yes - plan created first]
  - Did I add "READ .workflow/ first" directive at the top? [Yes - added at top]
  - Did I update checkboxes during work, not just at end? [To be verified during implementation]
  - Did I complete this retrospective section? [To be completed at end]
  - If No to any: What would have prevented this deviation?

### CRITICAL: What in the workflow could be done better keeping in mind this feature?
- [To be filled after feature completion]

### Workflow doc improvements needed:
- [To be filled after feature completion]

### Actions taken:
- [ ] Updated `.workflow/README.md` with clarifications
- [ ] Updated `.workflow/findings.md` with new patterns
- [ ] Updated `.workflow/feature_template.md` if needed

**This retrospective makes the workflow clearer for future work!**
