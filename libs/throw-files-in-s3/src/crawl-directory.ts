import fs from 'fs/promises'
import path from 'path'

/**
 * Recursively crawls the provided directory, applying the provided function
 * to every file it contains. Handles symlink cycles and uses asynchronous operations.
 */
export async function crawlDirectory(
    dir: string,
    fileCallback: (filePath: string) => void | Promise<void>,
    visited = new Set<string>(),
): Promise<void> {
    const resolvedPath = path.resolve(dir)

    // Avoid infinite loops
    if (visited.has(resolvedPath)) {
        return
    }
    visited.add(resolvedPath)

    try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true })

        for (const entry of entries) {
            const entryPath = path.join(resolvedPath, entry.name)

            if (entry.isDirectory()) {
                await crawlDirectory(entryPath, fileCallback, visited)
            } else if (entry.isFile()) {
                await fileCallback(entryPath)
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${resolvedPath}:`, err)
    }
}
