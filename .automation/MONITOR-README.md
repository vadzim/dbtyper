# GitHub Label Monitor - Stream-Based Architecture

This directory contains a TypeScript-based GitHub label monitoring system that automatically triggers issue implementations when labels are added.

## Overview

The monitoring script uses a simple stream-based architecture with async iterators:

- **Message stream**: Async iterable queue for all events
- **Main loop**: Async iterates over messages and processes them
- **Workers**: Async functions that send completion messages to stream
- **Poller**: Async function that sends poll events to stream
- **Smee**: Async function that sends webhook events to stream

## Features

- **Stream-based architecture**: All events flow through a single async iterable stream
- **Startup scanning**: Finds approved-but-not-in-progress issues on startup
- **Two monitoring modes:**
    - **Polling mode** (default): Checks GitHub API every N seconds (default: 30s)
    - **Webhook mode**: Real-time updates via smee.io
- **Concurrency control**: Limit simultaneous implementations (default: 1)
- **Worker IPC**: Workers send completion messages via stdout JSON
- **Queue system**: Processes pending issues when slots become available
- **Clean shutdown**: Graceful cleanup on SIGINT/SIGTERM

## Installation

The monitoring script uses Node.js native TypeScript support (Node.js v20.6+):

```bash
npm install
```

No additional TypeScript runtime needed - Node.js runs `.ts` files directly with `--experimental-strip-types`.

## Quick Start

The monitor runs autonomously in polling mode by default - no setup required:

```bash
# Start monitoring (polls every 30 seconds)
npm run monitor

# Custom settings
npm run monitor -- --poll-interval 60 --max-concurrent 3
```

## Usage

### Polling Mode (Default - Simplest)

```bash
# Basic usage (polls every 30 seconds, max 1 concurrent)
npm run monitor

# Custom poll interval (60 seconds)
npm run monitor -- --poll-interval 60

# Multiple concurrent implementations
npm run monitor -- --max-concurrent 3

# Both options
npm run monitor -- --poll-interval 60 --max-concurrent 3
```

### Webhook Mode (Real-time)

For real-time monitoring, you'll need to set up smee.io manually:

**Step 1: Create a smee.io channel**

Visit https://smee.io and create a new channel. You'll get a URL like `https://smee.io/YOUR_CHANNEL`.

**Step 2: Start smee client (Terminal 1)**

```bash
npx smee-client --url https://smee.io/YOUR_CHANNEL --port 3000
```

**Step 3: Start monitor (Terminal 2)**

```bash
# Using smee URL directly
npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

# Or save to .automation/smee-config.json:
# {"smeeUrl": "https://smee.io/YOUR_CHANNEL"}
npm run monitor -- --mode webhook
```

**Step 4: Configure GitHub webhook**

Go to your repository settings → Webhooks → Add webhook:

- Payload URL: Your smee.io URL
- Content type: application/json
- Events: Issues (specifically "labeled" events)

## Configuration

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (required, or use `gh auth login`)
- `GITHUB_OWNER` - Repository owner (optional, from config.json)
- `GITHUB_REPO` - Repository name (optional, from config.json)

### Configuration File

Create `.automation/config.json` (see `config.example.json`):

```json
{
	"automation": {
		"enabled": true,
		"approvalLabel": "approved",
		"maxParallelImplementations": 1,
		"checkInterval": 30
	},
	"github": {
		"owner": "your-username",
		"repo": "your-repo"
	}
}
```

## How It Works

### Architecture

```
Message Stream (async iterable)
    ↑
    ├─ Startup Scanner → messages (approved but not in-progress)
    ├─ Poller → messages (new approved issues)
    ├─ Smee Webhook → messages (real-time label events)
    └─ Workers → completion messages (via stdout JSON)

Main Loop (async iterator)
    ↓
    Processes messages sequentially
    ↓
    Starts workers or queues issues
```

### Flow

1. **Startup:**
    - Scans for issues with "approved" label but NOT "in-progress"
    - Adds these to message stream
    - Ensures no issues are missed during downtime

2. **Monitoring:**
    - **Polling mode:** Checks GitHub API every N seconds, sends messages for new approved issues
    - **Webhook mode:** Receives real-time events from GitHub via smee.io, sends messages

3. **Main Loop:**
    - Async iterates over message stream
    - For each message:
        - If worker completion: remove lock, start next queued issue
        - If issue approved: start worker if under limit, otherwise queue

4. **Workers:**
    - Spawned as detached bash processes
    - Send JSON completion message to stdout: `{"type":"complete","issueNumber":N,"success":true}`
    - Monitor receives message and processes next issue

5. **Shutdown:**
    - SIGINT/SIGTERM triggers AbortController
    - Stops poller/webhook
    - Closes message stream
    - Main loop finishes processing remaining messages

## CLI Options

```
--mode <polling|webhook>     Monitoring mode (default: polling)
--max-concurrent <number>    Max parallel implementations (default: 1)
--poll-interval <seconds>    Polling interval in seconds (default: 30)
--smee-url <url>            Smee.io URL for webhook mode (optional if using smee-config.json)
--help, -h                  Show help message
```

## Setup Scripts

### `npm run monitor:setup`

Automated setup for webhook mode:

- Creates a new smee.io channel
- Saves configuration to `.automation/smee-config.json`
- Configures GitHub webhook (or provides manual instructions)

After running this once, you can use `npm run monitor -- --mode webhook` without specifying the smee URL.

## Testing

To test the monitoring script:

1. Start the monitor:

    ```bash
    npm run monitor -- --poll-interval 10
    ```

2. Create a test issue:

    ```bash
    gh issue create --title "Test issue" --body "Test description"
    ```

3. Add the "approved" label:

    ```bash
    gh issue edit <number> --add-label "approved"
    ```

4. Watch the monitor output - it should detect the label and start implementation

5. Clean up:
    ```bash
    gh issue close <number>
    git worktree remove .worktrees/issue-<number>-* --force
    git branch -D feature/issue-<number>-*
    ```

## Comparison with Bash Version

### TypeScript Version (New)

- ✅ Better error handling and logging
- ✅ More maintainable and testable
- ✅ Type safety
- ✅ Easier to extend (webhook support)
- ✅ Better structured code
- ✅ Can run alongside bash version

### Bash Version (Existing)

- ✅ Simple and proven
- ✅ No dependencies beyond `gh` and `jq`
- ✅ Works well for basic polling

Both versions can coexist. The TypeScript version is recommended for new deployments.

## Architecture

```
monitor-github-labels.ts
├── Configuration loading
├── GitHub CLI integration (gh commands)
├── Lock file management
├── Implementation queue
│   ├── Concurrency control
│   ├── Queue processing
│   └── Implementation spawning
├── Polling monitor
│   ├── Periodic API checks
│   ├── Label change detection
│   └── Queue integration
└── Webhook monitor (optional)
    ├── Smee.io integration
    ├── Webhook server
    └── Event handling
```

## Troubleshooting

### Monitor not detecting issues

- Check GitHub CLI authentication: `gh auth status`
- Verify label exists: `gh label list`
- Check config.json has correct repo info
- Increase logging verbosity in the script

### Implementation not starting

- Check lock files: `ls .automation/.processing/`
- Check logs: `cat .automation/logs/issue-*.log`
- Verify `auto-implement-issue.sh` is executable
- Check worktree creation: `git worktree list`

### Webhook mode not working

- Install smee-client: `npm install -g smee-client`
- Verify smee URL is correct
- Check webhook server is listening on port 3000
- Configure GitHub webhook to point to smee.io URL

## Future Enhancements

- [ ] Better IPC between TypeScript and bash scripts
- [ ] Persistent queue (survive restarts)
- [ ] Metrics and monitoring dashboard
- [ ] Email/Slack notifications
- [ ] Support for multiple labels (not just "approved")
- [ ] Priority queue (high/medium/low priority issues)
- [ ] Retry logic for failed implementations
- [ ] Health check endpoint

## Related Files

- `.automation/auto-implement-issue.sh` - Main implementation orchestrator
- `.automation/monitor-approved-issues.sh` - Original bash monitoring script
- `.automation/config.example.json` - Configuration template
- `.workflow/automated-issue-implementation.md` - Workflow documentation
