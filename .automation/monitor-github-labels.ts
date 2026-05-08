#!/usr/bin/env tsx
/**
 * GitHub Label Monitor - TypeScript Implementation
 *
 * Monitors GitHub issues for label changes and triggers automated implementations.
 * Supports two modes:
 * - Polling: Check GitHub API every N seconds (default: 30s)
 * - Webhook: Real-time updates via smee.io
 */

import { spawn } from "node:child_process"
import { readFile, mkdir, writeFile, unlink, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// Types
// ============================================================================

interface Config {
	automation: {
		enabled: boolean
		approvalLabel: string
		autoMerge: boolean
		maxParallelImplementations: number
		checkInterval: number
	}
	worktree: {
		basePath: string
		branchPrefix: string
		cleanupAfterMerge: boolean
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

interface MonitorOptions {
	mode: "polling" | "webhook"
	maxConcurrent: number
	pollInterval: number
	smeeUrl?: string
}

// ============================================================================
// Configuration
// ============================================================================

async function loadConfig(): Promise<Config> {
	const configPath = join(__dirname, "config.json")

	if (!existsSync(configPath)) {
		console.warn("Warning: config.json not found, using defaults")
		return {
			automation: {
				enabled: true,
				approvalLabel: "approved",
				autoMerge: false,
				maxParallelImplementations: 1,
				checkInterval: 30,
			},
			worktree: {
				basePath: ".worktrees",
				branchPrefix: "feature/issue-",
				cleanupAfterMerge: true,
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

async function countProcessing(): Promise<number> {
	const processingDir = await ensureProcessingDir()
	try {
		const files = await readdir(processingDir)
		return files.filter(f => f.endsWith(".lock")).length
	} catch {
		return 0
	}
}

// ============================================================================
// Implementation Queue
// ============================================================================

class ImplementationQueue {
	private queue: Issue[] = []
	private processing = new Set<number>()
	private maxConcurrent: number

	constructor(maxConcurrent: number) {
		this.maxConcurrent = maxConcurrent
	}

	async canStart(): Promise<boolean> {
		const count = await countProcessing()
		return count < this.maxConcurrent
	}

	enqueue(issue: Issue): void {
		if (!this.queue.find(i => i.number === issue.number)) {
			this.queue.push(issue)
			console.log(`  Issue #${issue.number}: added to queue`)
		}
	}

	dequeue(): Issue | undefined {
		return this.queue.shift()
	}

	async processQueue(): Promise<void> {
		while (this.queue.length > 0 && (await this.canStart())) {
			const issue = this.dequeue()
			if (issue) {
				await this.startImplementation(issue)
			}
		}
	}

	async startImplementation(issue: Issue): Promise<void> {
		if (await isProcessing(issue.number)) {
			console.log(`  Issue #${issue.number}: already processing`)
			return
		}

		console.log(`  Issue #${issue.number}: starting implementation...`)
		// Note: Lock file is created by auto-implement-issue.sh, not here
		this.processing.add(issue.number)

		// Start implementation in background
		const scriptPath = join(__dirname, "auto-implement-issue.sh")
		const proc = spawn("bash", [scriptPath, issue.number.toString()], {
			detached: true,
			stdio: "ignore",
		})

		proc.unref()

		// Monitor completion (simplified - in production, use better IPC)
		proc.on("exit", async code => {
			this.processing.delete(issue.number)

			if (code === 0) {
				console.log(`[${new Date().toISOString()}] Issue #${issue.number}: implementation completed`)
			} else {
				console.log(
					`[${new Date().toISOString()}] Issue #${issue.number}: implementation failed (exit code: ${code})`,
				)
				// Lock file is cleaned up by bash script
			}

			// Process next in queue
			await this.processQueue()
		})
	}
}

// ============================================================================
// Polling Monitor
// ============================================================================

class PollingMonitor {
	private config: Config
	private queue: ImplementationQueue
	private pollInterval: number
	private knownIssues = new Map<number, string[]>()

	constructor(config: Config, queue: ImplementationQueue, pollInterval: number) {
		this.config = config
		this.queue = queue
		this.pollInterval = pollInterval
	}

	async start(): Promise<void> {
		console.log("Starting polling monitor...")
		console.log(`Poll interval: ${this.pollInterval}s`)
		console.log(`Max concurrent: ${this.queue["maxConcurrent"]}`)
		console.log(`Approval label: ${this.config.automation.approvalLabel}`)
		console.log("")

		// Initial load
		await this.poll()

		// Start polling loop
		setInterval(() => this.poll(), this.pollInterval * 1000)
	}

	private async poll(): Promise<void> {
		console.log(`[${new Date().toISOString()}] Checking for approved issues...`)

		const issues = await fetchApprovedIssues(this.config.automation.approvalLabel)

		if (issues.length === 0) {
			console.log("No approved issues found")
		} else {
			console.log(`Found ${issues.length} approved issue(s)`)

			for (const issue of issues) {
				const prev = this.knownIssues.get(issue.number)

				if (!prev) {
					// New issue with approved label
					console.log(`  Issue #${issue.number}: newly approved`)
					this.queue.enqueue(issue)
				} else {
					// Check if approved label was just added
					const hadApproved = prev.includes(this.config.automation.approvalLabel)
					const hasApproved = issue.labels.includes(this.config.automation.approvalLabel)

					if (!hadApproved && hasApproved) {
						console.log(`  Issue #${issue.number}: approved label added`)
						this.queue.enqueue(issue)
					}
				}

				this.knownIssues.set(issue.number, issue.labels)
			}

			// Process queue
			await this.queue.processQueue()
		}

		console.log("")
	}
}

// ============================================================================
// Webhook Monitor (via smee.io)
// ============================================================================

class WebhookMonitor {
	private config: Config
	private queue: ImplementationQueue
	private smeeUrl: string

	constructor(config: Config, queue: ImplementationQueue, smeeUrl: string) {
		this.config = config
		this.queue = queue
		this.smeeUrl = smeeUrl
	}

	async start(): Promise<void> {
		console.log("Starting webhook monitor...")
		console.log(`Smee URL: ${this.smeeUrl}`)
		console.log(`Max concurrent: ${this.queue["maxConcurrent"]}`)
		console.log(`Approval label: ${this.config.automation.approvalLabel}`)
		console.log("")

		// Check if smee-client is installed
		try {
			await execGh(["--version"]) // Just to test gh is available
		} catch {
			console.error("Error: GitHub CLI (gh) is not installed")
			process.exit(1)
		}

		// Start smee client
		const smeeProc = spawn("smee", ["--url", this.smeeUrl, "--port", "3000"], {
			stdio: "inherit",
		})

		smeeProc.on("error", error => {
			console.error("Error starting smee client:", error)
			console.error("Make sure smee-client is installed: npm install -g smee-client")
			process.exit(1)
		})

		// Start webhook server
		await this.startWebhookServer()
	}

	private async startWebhookServer(): Promise<void> {
		// For MVP, we'll use a simple HTTP server
		// In production, use Express or similar
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
						await this.handleWebhook(payload)
						res.writeHead(200)
						res.end("OK")
					} catch (error) {
						console.error("Error handling webhook:", error)
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
			console.log("Webhook server listening on port 3000")
		})
	}

	private async handleWebhook(payload: any): Promise<void> {
		const { action, label, issue } = payload

		if (!action || !issue) {
			return
		}

		if (action === "labeled" && label?.name === this.config.automation.approvalLabel) {
			console.log(`[${new Date().toISOString()}] Issue #${issue.number}: approved label added`)

			const issueData: Issue = {
				number: issue.number,
				title: issue.title,
				labels: issue.labels.map((l: any) => l.name),
			}

			this.queue.enqueue(issueData)
			await this.queue.processQueue()
		}
	}
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
			options.maxConcurrent = parseInt(args[++i], 10)
			if (isNaN(options.maxConcurrent) || options.maxConcurrent < 1) {
				console.error("Error: --max-concurrent must be a positive integer")
				process.exit(1)
			}
		} else if (arg === "--poll-interval" && i + 1 < args.length) {
			options.pollInterval = parseInt(args[++i], 10)
			if (isNaN(options.pollInterval) || options.pollInterval < 1) {
				console.error("Error: --poll-interval must be a positive integer")
				process.exit(1)
			}
		} else if (arg === "--smee-url" && i + 1 < args.length) {
			options.smeeUrl = args[++i]
		} else if (arg === "--help" || arg === "-h") {
			printHelp()
			process.exit(0)
		} else {
			console.error(`Error: Unknown argument "${arg}"`)
			printHelp()
			process.exit(1)
		}
	}

	// Validate webhook mode
	if (options.mode === "webhook" && !options.smeeUrl) {
		// Try to load smee URL from config file
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
			// Ignore errors, will show error below
		}

		if (!options.smeeUrl) {
			console.error("Error: --smee-url is required for webhook mode")
			console.error("Run 'npm run monitor:setup' to configure webhook")
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

  # Polling with custom interval
  npm run monitor -- --poll-interval 60

  # Webhook mode
  npm run monitor -- --mode webhook --smee-url https://smee.io/YOUR_CHANNEL

  # Webhook mode (reads URL from smee-config.json)
  npm run monitor -- --mode webhook

Setup:
  npm run monitor:setup    Configure GitHub webhook with smee.io

Environment Variables:
  GITHUB_TOKEN    GitHub personal access token (required)
  GITHUB_OWNER    Repository owner (optional, from config.json)
  GITHUB_REPO     Repository name (optional, from config.json)
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

	// Create queue
	const queue = new ImplementationQueue(config.automation.maxParallelImplementations)

	// Start appropriate monitor
	if (options.mode === "polling") {
		const monitor = new PollingMonitor(config, queue, options.pollInterval)
		await monitor.start()
	} else {
		const monitor = new WebhookMonitor(config, queue, options.smeeUrl!)
		await monitor.start()
	}

	// Handle graceful shutdown
	process.on("SIGINT", () => {
		console.log("\nShutting down...")
		process.exit(0)
	})

	process.on("SIGTERM", () => {
		console.log("\nShutting down...")
		process.exit(0)
	})
}

main().catch(error => {
	console.error("Fatal error:", error)
	process.exit(1)
})
