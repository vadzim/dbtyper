import type { SourcePos } from "./read-types.ts"

export type SourceHighlight = {
	/** 1-based line number (same as {@link SourcePos}). */
	line: number
	/** 1-based start column (inclusive). */
	column: number
	/** 1-based end column (inclusive). Defaults to `column`. */
	endColumn?: number
}

/** Anchor for {@link formatSourceSnippet}: 1-based line, UTF-16 `startPos` in `source`, and marker width. */
export type FormatSourceSnippetAnchor = {
	/** 1-based line number (same as {@link SourcePos.line}). */
	line: number
	/** UTF-16 character offset in `source` where the red `~` marker starts (same as {@link SourcePos.start}). */
	startPos: number
	/** Number of `~` characters (e.g. type name length). */
	textLength: number
}

export type FormatSourceSnippetOptions = {
	/** Lines above the highlighted line (default 3). */
	contextBefore?: number
	/** Lines below the highlighted line (default 0). */
	contextAfter?: number
	/** Force ANSI colors even when stdout is not a TTY. */
	forceColor?: boolean
	/** Strip ANSI sequences (no colors / no reversed line numbers). */
	noColor?: boolean
	/** Tab width for aligning markers when lines contain tab characters (default {@link DEFAULT_SNIPPET_TAB_WIDTH}). */
	tabWidth?: number
}

/** Tab size in spaces: each tab advances to the next tab stop; used by {@link formatSourceSnippet} unless `tabWidth` is set. */
export const DEFAULT_SNIPPET_TAB_WIDTH = 4

export type SourcePosLike = {
	line: number
	column: number
	start: number
	end: number
}

const ansi = {
	reset: "\x1b[0m",
	reverse: "\x1b[7m",
	red: "\x1b[31m",
} as const

function useAnsi(options?: FormatSourceSnippetOptions): boolean {
	if (options?.noColor) return false
	if (options?.forceColor) return true
	return typeof process !== "undefined" && Boolean(process.stdout?.isTTY)
}

function gutterWidthForRange(startLine: number, endLine: number): number {
	return Math.max(String(startLine).length, String(endLine).length)
}

function formatGutterLine(
	lineNo: number,
	gutterW: number,
	sourceText: string,
	color: boolean,
): string {
	const padded = String(lineNo).padStart(gutterW, " ")
	const num = color ? `${ansi.reverse}${padded}${ansi.reset}` : padded
	return `${num} | ${sourceText}`
}

function blankGutter(gutterW: number): string {
	return `${" ".repeat(gutterW)} | `
}

/** Visual column (0-based) after processing `line[0..end)`; tabs advance to tab stops. */
function visualWidthUpTo(line: string, end: number, tabWidth: number): number {
	let w = 0
	const n = Math.max(0, Math.min(end, line.length))
	for (let i = 0; i < n; i++) {
		const c = line[i]
		if (c === "\t") {
			w += tabWidth - (w % tabWidth)
		} else {
			w += 1
		}
	}
	return w
}

/** Replace tabs with spaces so printed width matches {@link visualWidthUpTo}. */
function expandTabsInLine(line: string, tabWidth: number): string {
	let out = ""
	let col = 0
	for (let i = 0; i < line.length; i++) {
		const c = line[i]
		if (c === "\t") {
			const n = tabWidth - (col % tabWidth)
			out += " ".repeat(n)
			col += n
		} else {
			out += c
			col += 1
		}
	}
	return out
}

/** Prefer when `readTypes` already filled `line` / `column` / `start` / `end`. */
export function highlightFromSourcePos(source: string, pos: SourcePos): SourceHighlight {
	const lines = splitLines(source)
	const li = pos.line - 1
	const text = lines[li]
	if (text === undefined) {
		return { line: pos.line, column: 1, endColumn: 1 }
	}
	const col = Math.max(1, Math.min(pos.column, text.length + 1))
	const lineStart = lineStartOffset(source, lines, pos.line)
	const endOnLine = Math.min(pos.end, lineStart + text.length)
	const endCol = Math.max(col, Math.min(endOnLine - lineStart + 1, text.length + 1))
	return { line: pos.line, column: col, endColumn: endCol }
}

/**
 * Build highlight from UTF-16 offsets (same as TS). If `start`/`end` span newlines, `end` is clipped
 * to the end of the start line.
 */
export function highlightFromOffsets(source: string, pos: SourcePosLike): SourceHighlight {
	const lines = splitLines(source)
	let offset = 0
	for (let i = 0; i < lines.length; i++) {
		const lineText = lines[i] ?? ""
		const lineStart = offset
		const contentEnd = offset + lineText.length
		const onLastLine = i === lines.length - 1
		if (pos.start <= contentEnd || onLastLine) {
			const colStart = Math.max(1, pos.start - lineStart + 1)
			const endClipped = Math.min(pos.end, contentEnd)
			const colEnd = Math.max(colStart, Math.min(endClipped - lineStart + 1, lineText.length + 1))
			return { line: i + 1, column: colStart, endColumn: colEnd }
		}
		offset = contentEnd + newlineLen(source, contentEnd)
	}
	return { line: 1, column: 1, endColumn: 1 }
}

/**
 * Renders numbered context lines (reversed line numbers when ANSI enabled), the highlighted line,
 * then a red `~` marker of length `anchor.textLength` starting at column derived from `anchor.startPos`
 * on `anchor.line`.
 */
export function formatSourceSnippet(
	source: string,
	anchor: FormatSourceSnippetAnchor,
	options?: FormatSourceSnippetOptions,
): string {
	const before = options?.contextBefore ?? 3
	const after = options?.contextAfter ?? 0
	const tabWidth =
		typeof options?.tabWidth === "number" && Number.isFinite(options.tabWidth) && options.tabWidth >= 1
			? Math.floor(options.tabWidth)
			: DEFAULT_SNIPPET_TAB_WIDTH
	const color = useAnsi(options)
	const lines = splitLines(source)
	const lineIndex = anchor.line - 1
	if (lineIndex < 0 || lineIndex >= lines.length) {
		return ""
	}

	const text = lines[lineIndex]
	if (text === undefined) {
		return ""
	}

	const lineStart = lineStartOffset(source, lines, anchor.line)
	const rel0 = Math.max(0, Math.min(anchor.startPos - lineStart, text.length))
	const rawLen = anchor.textLength
	const tildeCodeUnits =
		typeof rawLen === "number" && Number.isFinite(rawLen) && rawLen >= 1 ? Math.floor(rawLen) : 1
	const rel1 = Math.min(rel0 + tildeCodeUnits, text.length)
	const visualStart = visualWidthUpTo(text, rel0, tabWidth)
	const visualEnd = visualWidthUpTo(text, rel1, tabWidth)
	const tildeCount = Math.max(1, visualEnd - visualStart)

	const start = Math.max(0, lineIndex - before)
	const end = Math.min(lines.length - 1, lineIndex + after)
	const gutterW = gutterWidthForRange(start + 1, end + 1)
	const blank = blankGutter(gutterW)
	const out: string[] = []

	for (let i = start; i <= end; i++) {
		const lineText = lines[i]
		if (lineText === undefined) continue
		const displayLine = i + 1
		const displayText = expandTabsInLine(lineText, tabWidth)

		if (i < lineIndex) {
			out.push(formatGutterLine(displayLine, gutterW, displayText, color))
		} else if (i === lineIndex) {
			out.push(formatGutterLine(displayLine, gutterW, displayText, color))
			const tildes = "~".repeat(tildeCount)
			const marker = color ? `${ansi.red}${tildes}${ansi.reset}` : tildes
			out.push(`${blank}${" ".repeat(visualStart)}${marker}`)
		} else {
			out.push(formatGutterLine(displayLine, gutterW, displayText, color))
		}
	}

	return out.join("\n")
}

function splitLines(source: string): string[] {
	return source.split(/\r\n|\n|\r/)
}

function newlineLen(source: string, at: number): number {
	if (at >= source.length) return 0
	if (source[at] === "\r" && source[at + 1] === "\n") return 2
	if (source[at] === "\n" || source[at] === "\r") return 1
	return 0
}

function lineStartOffset(source: string, lines: string[], oneBasedLine: number): number {
	let o = 0
	for (let i = 0; i < oneBasedLine - 1; i++) {
		const seg = lines[i] ?? ""
		o += seg.length + newlineLen(source, o + seg.length)
	}
	return o
}
