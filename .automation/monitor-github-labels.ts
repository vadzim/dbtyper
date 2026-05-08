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

import { spawn } from "node:child_process"
import { readFile, mkdir, writeFile, unlink, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { PassThrough } from "node:stream"
import { setTimeout } from "node:timers/promises"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface Config {
	automation: {
		enabled: boolean
		approvalLabel: string
		maxParallelImplementations: number
	}
	github: {
		owner: string
		repo: string
	}
}

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
// Configuration
// ============================================================================

async function loadConfig(): Promise<Config> {
	const configPath = join(__dirname, "config.json")

	if (!existsSync(configPath)) {
		return {
			automation: {
				enabled: true,
				approvalLabel: "approved",
				maxParallelImplementations: 1,
			},
			github: {
				owner: process.env.GITHUB_OWNER || "",
				repo: process.env.GITHUB_REPO || "",
			},
		}
	}

	const content = await readFile(configPath, "utf-8")
	return JSON.parse(content)
}

// ============================================================================
// GitHub CLI Integration
// ============================================================================

async function execGh(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn("gh", args, {
			stdio: ["ignore", "pipe", "pipe"],
		})

		let stdout = ""
		let stderr = ""

		proc.stdout.on("data", data => {
			stdout += data.toString()
		})

		proc.stderr.on("data", data => {
			stderr += data.toString()
		})

		proc.on("close", code => {
			if (code === 0) {
				resolve(stdout)
			} else {
				reject(new Error(`gh command failed (exit ${code}): ${stderr}`))
			}
		})
	})
}

async function fetchApprovedIssues(approvalLabel: string): Promise<Issue[]> {
	try {
		const output = await execGh([
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

async function startupScan(stream: ReturnType<typeof createMessageStream>, approvalLabel: string): Promise<void> {
	console.log("[Startup] Scanning for approved issues...")

	const issues = await fetchApprovedIssues(approvalLabel)
	const pending = issues.filter(issue => !issue.labels.includes("in-progress"))

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
		await setTimeout(pollInterval * 1000, null, { signal })
	}

	console.log("[Poller] Stopped")
}

// ============================================================================
// Webhook (Smee)
// ============================================================================

async function startWebhook(
	stream: ReturnType<typeof createMessageStream>,
	smeeUrl: string,
	approvalLabel: string,
	signal: AbortSignal,
): Promise<void> {
	console.log(`[Webhook] Starting smee client: ${smeeUrl}`)

	// Start smee-client
	const smeeProc = spawn("npx", ["smee-client", "--url", smeeUrl, "--port", "3000"], {
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

	server.listen(3000, () => {
		console.log("[Webhook] Server listening on port 3000")
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
		} else if (arg === "--help" || arg === "-h") {
			printHelp()
			process.exit(0)
		} else {
			console.error(`Error: Unknown argument "${arg}"`)
			printHelp()
			process.exit(1)
		}
	}

	// Try to load smee URL from config if webhook mode
	if (options.mode === "webhook" && !options.smeeUrl) {
		try {
			const configPath = join(__dirname, "smee-config.json")
			if (existsSync(configPath)) {
				const configContent = await readFile(configPath, "utf-8")
				const config = JSON.parse(configContent)
				if (config.smeeUrl) {
					options.smeeUrl = config.smeeUrl
					console.log(`Using smee URL from config: ${options.smeeUrl}`)
				}
			}
		} catch (error) {
			// Ignore
		}

		if (!options.smeeUrl) {
			console.error("Error: --smee-url is required for webhook mode")
			console.error("Either provide --smee-url or use polling mode (default)")
			process.exit(1)
		}
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
  --help, -h                  Show this help message

Examples:
  # Polling mode (default)
  npm run monitor

  # Polling with 3 concurrent implementations
  npm run monitor -- --max-concurrent 3

  # Webhook mode (provide smee URL)
  npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

Environment Variables:
  GITHUB_TOKEN    GitHub personal access token (required)
`)
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
	const options = await parseArgs()
	const config = await loadConfig()

	// Override max concurrent from CLI
	if (options.maxConcurrent) {
		config.automation.maxParallelImplementations = options.maxConcurrent
	}

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
	const mainLoopPromise = mainLoop(stream, config.automation.maxParallelImplementations)

	// Start startup scan
	await startupScan(stream, config.automation.approvalLabel)

	// Start appropriate monitor
	if (options.mode === "polling") {
		startPoller(stream, config.automation.approvalLabel, options.pollInterval, abortController.signal)
	} else {
		startWebhook(stream, options.smeeUrl!, config.automation.approvalLabel, abortController.signal)
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
