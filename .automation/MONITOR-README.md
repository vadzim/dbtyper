# GitHub Label Monitor - TypeScript Implementation

This directory contains a TypeScript-based GitHub label monitoring system that automatically triggers issue implementations when labels are added.

## Overview

The monitoring script watches GitHub issues for label changes and automatically starts the implementation process when the "approved" label is detected.

## Features

- **Two monitoring modes:**
  - **Polling mode** (default): Checks GitHub API every N seconds (default: 30s)
  - **Webhook mode**: Real-time updates via smee.io
- **Concurrency control**: Limit simultaneous implementations (default: 1)
- **Lock file management**: Prevents duplicate processing
- **Queue system**: Processes pending issues when slots become available
- **Integration**: Works with existing `auto-implement-issue.sh` automation

## Installation

The monitoring script requires `tsx` to run TypeScript directly:

```bash
npm install
```

## Usage

### Polling Mode (Default)

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

### Webhook Mode (via smee.io)

```bash
# Basic webhook mode
npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

# With concurrency control
npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL --max-concurrent 2
```

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

1. **Monitor detects approved issue:**
   - Polling mode: Checks GitHub API every N seconds
   - Webhook mode: Receives real-time events from smee.io

2. **Queue management:**
   - Issue added to queue if not already processing
   - Checks if capacity available (max concurrent limit)
   - Starts implementation if slot available

3. **Implementation process:**
   - Calls `auto-implement-issue.sh` with issue number
   - Bash script creates worktree, launches AI agent, runs tests
   - Lock file created by bash script (not TypeScript)

4. **Completion:**
   - When implementation completes, slot freed
   - Next queued issue starts automatically

## CLI Options

```
--mode <polling|webhook>     Monitoring mode (default: polling)
--max-concurrent <number>    Max parallel implementations (default: 1)
--poll-interval <seconds>    Polling interval in seconds (default: 30)
--smee-url <url>            Smee.io URL for webhook mode
--help, -h                  Show help message
```

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
