#!/usr/bin/env node
/**
 * GitHub Label Monitor - Simple Stream-Based Architecture
 *
 * Architecture:
 * - Message stream (async iterable)
 * - Main loop: async iterates over messages
 * - Workers: async functions that send completion messages to stream
 * - Poller: async function that sends messages to stream
 * - Smee: async function that sends messages to stream
 */

import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { PassThrough } from "node:stream"
import { setTimeout } from "node:timers/promises"

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface Issue {
	number: number
	title: string
	labels: string[]
}

type Message =
	| { type: "startup-scan"; issue: Issue }
	| { type: "poll"; issue: Issue }
	| { type: "webhook"; issue: Issue }
	| { type: "worker-complete"; issueNumber: number; success: boolean }

interface MonitorOptions {
	mode: "polling" | "webhook"
	maxConcurrent: number
	pollInterval: number
	smeeUrl?: string
	smeePort: number
	approvedLabel: string
	inProgressLabel: string
}

// ============================================================================
// Message Stream
// ============================================================================

function createMessageStream() {
	const stream = new PassThrough({ objectMode: true })
	return {
		push: (message: Message) => stream.write(message),
		close: () => stream.end(),
		[Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
	}
}

// ============================================================================
// GitHub CLI Integration
// ============================================================================

async function fetchApprovedIssues(approvalLabel: string): Promise<Issue[]> {
	try {
		const { stdout: output } = await execFileAsync("gh", [
			"issue",
			"list",
			"--label",
			approvalLabel,
			"--state",
			"open",
			"--json",
			"number,title,labels",
		])

		const issues = JSON.parse(output) as Array<{
			number: number
			title: string
			labels: Array<{ name: string }>
		}>

		return issues.map(issue => ({
			number: issue.number,
			title: issue.title,
			labels: issue.labels.map(l => l.name),
		}))
	} catch (error) {
		console.error("Error fetching approved issues:", error)
		return []
	}
}

// ============================================================================
// Lock File Management
// ============================================================================

async function ensureProcessingDir(): Promise<string> {
	const processingDir = join(__dirname, ".processing")
	await mkdir(processingDir, { recursive: true })
	return processingDir
}

async function isProcessing(issueNumber: number): Promise<boolean> {
	const processingDir = await ensureProcessingDir()
	const lockFile = join(processingDir, `issue-${issueNumber}.lock`)
	return existsSync(lockFile)
}

async function createLock(issueNumber: number): Promise<void> {
	const processingDir = await ensureProcessingDir()
	const lockFile = join(processingDir, `issue-${issueNumber}.lock`)
	await writeFile(lockFile, new Date().toISOString(), "utf-8")
}

async function removeLock(issueNumber: number): Promise<void> {
	const processingDir = await ensureProcessingDir()
	const lockFile = join(processingDir, `issue-${issueNumber}.lock`)
	try {
		await unlink(lockFile)
	} catch (error) {
		// Ignore if file doesn't exist
	}
}

// ============================================================================
// Startup Scanner
// ============================================================================

async function startupScan(
	stream: ReturnType<typeof createMessageStream>,
	approvalLabel: string,
	inProgressLabel: string,
): Promise<void> {
	console.log("[Startup] Scanning for approved issues...")

	const issues = await fetchApprovedIssues(approvalLabel)
	const pending = issues.filter(issue => !issue.labels.includes(inProgressLabel))

	console.log(`[Startup] Found ${pending.length} pending issue(s)`)

	for (const issue of pending) {
		stream.push({ type: "startup-scan", issue })
	}
}

// ============================================================================
// Poller
// ============================================================================

async function startPoller(
	stream: ReturnType<typeof createMessageStream>,
	approvalLabel: string,
	pollInterval: number,
	signal: AbortSignal,
): Promise<void> {
	const knownIssues = new Map<number, string[]>()

	console.log(`[Poller] Starting (interval: ${pollInterval}s)`)

	while (!signal.aborted) {
		try {
			const issues = await fetchApprovedIssues(approvalLabel)

			for (const issue of issues) {
				const prev = knownIssues.get(issue.number)

				if (!prev) {
					// New issue
					console.log(`[Poller] New approved issue: #${issue.number}`)
					stream.push({ type: "poll", issue })
				} else {
					// Check if approved label was just added
					const hadApproved = prev.includes(approvalLabel)
					const hasApproved = issue.labels.includes(approvalLabel)

					if (!hadApproved && hasApproved) {
						console.log(`[Poller] Issue approved: #${issue.number}`)
						stream.push({ type: "poll", issue })
					}
				}

				knownIssues.set(issue.number, issue.labels)
			}
		} catch (error) {
			console.error("[Poller] Error:", error)
		}

		// Wait for next poll
		try {
			await setTimeout(pollInterval * 1000, null, { signal })
		} catch (error) {
			// AbortError when signal is aborted - this is expected
			if ((error as Error).name === "AbortError") {
				break
			}
			throw error
		}
	}

	console.log("[Poller] Stopped")
}

// ============================================================================
// Webhook (Smee)
// ============================================================================

async function startWebhook(
	stream: ReturnType<typeof createMessageStream>,
	smeeUrl: string,
	smeePort: number,
	approvalLabel: string,
	signal: AbortSignal,
): Promise<void> {
	console.log(`[Webhook] Starting smee client: ${smeeUrl}`)
	console.log(`[Webhook] Listening on port: ${smeePort}`)

	// Start smee-client
	const smeeProc = spawn("npx", ["smee-client", "--url", smeeUrl, "--port", smeePort.toString()], {
		stdio: "inherit",
	})

	signal.addEventListener("abort", () => {
		smeeProc.kill()
	})

	// Start webhook server
	const http = await import("node:http")

	const server = http.createServer(async (req, res) => {
		if (req.method === "POST" && req.url === "/") {
			let body = ""
			req.on("data", chunk => {
				body += chunk.toString()
			})

			req.on("end", async () => {
				try {
					const payload = JSON.parse(body)
					const { action, label, issue } = payload

					if (action === "labeled" && label?.name === approvalLabel) {
						console.log(`[Webhook] Issue approved: #${issue.number}`)

						const issueData: Issue = {
							number: issue.number,
							title: issue.title,
							labels: issue.labels.map((l: any) => l.name),
						}

						stream.push({ type: "webhook", issue: issueData })
					}

					res.writeHead(200)
					res.end("OK")
				} catch (error) {
					console.error("[Webhook] Error handling webhook:", error)
					res.writeHead(500)
					res.end("Error")
				}
			})
		} else {
			res.writeHead(404)
			res.end("Not Found")
		}
	})

	server.listen(smeePort, () => {
		console.log(`[Webhook] Server listening on port ${smeePort}`)
	})

	signal.addEventListener("abort", () => {
		server.close()
		console.log("[Webhook] Stopped")
	})
}

// ============================================================================
// Worker
// ============================================================================

async function startWorker(issueNumber: number, stream: ReturnType<typeof createMessageStream>): Promise<void> {
	console.log(`[Worker] Starting implementation for issue #${issueNumber}`)

	await createLock(issueNumber)

	const scriptPath = join(__dirname, "auto-implement-issue.sh")
	const proc = spawn("bash", [scriptPath, issueNumber.toString()], {
		detached: true,
		stdio: ["ignore", "pipe", "inherit"],
	})

	proc.unref()

	// Listen for completion message from worker
	let buffer = ""
	proc.stdout?.on("data", (data: Buffer) => {
		buffer += data.toString()
		const lines = buffer.split("\n")
		buffer = lines.pop() || ""

		for (const line of lines) {
			try {
				const msg = JSON.parse(line)
				if (msg.type === "complete") {
					stream.push({
						type: "worker-complete",
						issueNumber: msg.issueNumber,
						success: msg.success,
					})
				}
			} catch {
				// Not JSON, ignore
			}
		}
	})

	// Fallback: if worker exits without sending message
	proc.on("exit", async code => {
		// Only send if we haven't received a completion message
		await setTimeout(1000)
		stream.push({
			type: "worker-complete",
			issueNumber,
			success: code === 0,
		})
	})
}

// ============================================================================
// Main Loop
// ============================================================================

async function mainLoop(stream: ReturnType<typeof createMessageStream>, maxConcurrent: number): Promise<void> {
	const queue: Issue[] = []
	const processing = new Set<number>()

	console.log(`[Main] Starting (max concurrent: ${maxConcurrent})`)

	for await (const message of stream) {
		console.log(`[Main] Message: ${message.type}`)

		if (message.type === "worker-complete") {
			// Worker completed
			const { issueNumber, success } = message
			processing.delete(issueNumber)
			await removeLock(issueNumber)

			console.log(`[Main] Worker completed: #${issueNumber} (${success ? "success" : "failed"})`)

			// Start next queued issue if available
			if (queue.length > 0 && processing.size < maxConcurrent) {
				const nextIssue = queue.shift()!
				processing.add(nextIssue.number)
				await startWorker(nextIssue.number, stream)
			}
		} else {
			// Issue approved (from startup, poll, or webhook)
			const { issue } = message

			// Check if already processing
			if (processing.has(issue.number) || (await isProcessing(issue.number))) {
				console.log(`[Main] Issue #${issue.number} already processing, skipping`)
				continue
			}

			// Check if already queued
			if (queue.find(i => i.number === issue.number)) {
				console.log(`[Main] Issue #${issue.number} already queued, skipping`)
				continue
			}

			// Start worker if under limit, otherwise queue
			if (processing.size < maxConcurrent) {
				processing.add(issue.number)
				await startWorker(issue.number, stream)
			} else {
				console.log(`[Main] Queueing issue #${issue.number} (at capacity)`)
				queue.push(issue)
			}
		}
	}

	console.log("[Main] Stopped")
}

// ============================================================================
// CLI
// ============================================================================

async function parseArgs(): Promise<MonitorOptions> {
	const args = process.argv.slice(2)
	const options: MonitorOptions = {
		mode: "polling",
		maxConcurrent: 1,
		pollInterval: 30,
		smeePort: 7149,
		approvedLabel: "approved",
		inProgressLabel: "in-progress",
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		if (arg === "--mode" && i + 1 < args.length) {
			const mode = args[++i]
			if (mode !== "polling" && mode !== "webhook") {
				console.error(`Error: Invalid mode "${mode}". Must be "polling" or "webhook"`)
				process.exit(1)
			}
			options.mode = mode
		} else if (arg === "--max-concurrent" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.maxConcurrent = parseInt(value, 10)
				if (isNaN(options.maxConcurrent) || options.maxConcurrent < 1) {
					console.error("Error: --max-concurrent must be a positive integer")
					process.exit(1)
				}
			}
		} else if (arg === "--poll-interval" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.pollInterval = parseInt(value, 10)
				if (isNaN(options.pollInterval) || options.pollInterval < 1) {
					console.error("Error: --poll-interval must be a positive integer")
					process.exit(1)
				}
			}
		} else if (arg === "--smee-url" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.smeeUrl = value
			}
		} else if (arg === "--smee-port" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.smeePort = parseInt(value, 10)
				if (isNaN(options.smeePort) || options.smeePort < 1 || options.smeePort > 65535) {
					console.error("Error: --smee-port must be a valid port number (1-65535)")
					process.exit(1)
				}
			}
		} else if (arg === "--approved" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.approvedLabel = value
			}
		} else if (arg === "--in-progress" && i + 1 < args.length) {
			const value = args[++i]
			if (value) {
				options.inProgressLabel = value
			}
		} else if (arg === "--help" || arg === "-h") {
			printHelp()
			process.exit(0)
		} else {
			console.error(`Error: Unknown argument "${arg}"`)
			printHelp()
			process.exit(1)
		}
	}

	// Validate webhook mode requires smee URL
	if (options.mode === "webhook" && !options.smeeUrl) {
		console.error("Error: --smee-url is required for webhook mode")
		console.error("Either provide --smee-url or use polling mode (default)")
		process.exit(1)
	}

	return options
}

function printHelp(): void {
	console.log(`
GitHub Label Monitor

Usage:
  npm run monitor [options]

Options:
  --mode <polling|webhook>     Monitoring mode (default: polling)
  --max-concurrent <number>    Max parallel implementations (default: 1)
  --poll-interval <seconds>    Polling interval in seconds (default: 30)
  --smee-url <url>            Smee.io URL for webhook mode
  --smee-port <port>          Port for webhook server (default: 7149)
  --approved <label>          Approval label name (default: approved)
  --in-progress <label>       In-progress label name (default: in-progress)
  --help, -h                  Show this help message

Examples:
  # Polling mode (default)
  npm run monitor

  # Polling with 3 concurrent implementations
  npm run monitor -- --max-concurrent 3

  # Webhook mode (provide smee URL)
  npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

  # Webhook mode with custom port
  npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL --smee-port 8080

  # Custom labels
  npm run monitor -- --approved "auto-implement" --in-progress "implementing"

Environment Variables:
  GITHUB_TOKEN    GitHub personal access token (required)
`)
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
	const options = await parseArgs()

	// Create message stream
	const stream = createMessageStream()

	// Create abort controller for cleanup
	const abortController = new AbortController()

	// Handle graceful shutdown
	process.on("SIGINT", () => {
		console.log("\nShutting down...")
		abortController.abort()
		stream.close()
	})

	process.on("SIGTERM", () => {
		console.log("\nShutting down...")
		abortController.abort()
		stream.close()
	})

	// Start main loop
	const mainLoopPromise = mainLoop(stream, options.maxConcurrent)

	// Start startup scan
	await startupScan(stream, options.approvedLabel, options.inProgressLabel)

	// Start appropriate monitor
	if (options.mode === "polling") {
		startPoller(stream, options.approvedLabel, options.pollInterval, abortController.signal)
	} else {
		startWebhook(stream, options.smeeUrl!, options.smeePort, options.approvedLabel, abortController.signal)
	}

	// Wait for main loop to finish
	await mainLoopPromise
}

try {
	await main()
} catch (error) {
	console.error("Fatal error:", error)
	process.exit(1)
}
