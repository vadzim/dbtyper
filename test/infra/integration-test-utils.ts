import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const integrationDir = join(process.cwd(), "test", "integration")

export async function getIntegrationTestFiles() {
	return (await readdir(integrationDir, { recursive: true, withFileTypes: true }))
		.filter(f => f.isFile() && !f.name.endsWith(".md"))
		.map(f => join(f.parentPath, f.name))
		.map(fullPath => ({
			fullPath,
			file: fullPath.replace(integrationDir, ""),
			contentIO: readFile(fullPath, "utf-8"),
		}))
}
