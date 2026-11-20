import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const integrationDir = join(process.cwd(), "test", "integration")
const stressDir = join(process.cwd(), "test", "stress")

export const getIntegrationTestFiles = () => getTestFiles(integrationDir)
export const getStressTestFiles = () => getTestFiles(stressDir)

async function getTestFiles(dir: string) {
	return (await readdir(dir, { recursive: true, withFileTypes: true }))
		.filter(f => f.isFile() && !f.name.endsWith(".md"))
		.map(f => join(f.parentPath, f.name))
		.map(fullPath => ({
			fullPath,
			file: fullPath.replace(dir, ""),
			contentIO: readFile(fullPath, "utf-8"),
		}))
}
