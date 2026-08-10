/**
 * @module contracts/file-system
 * @description Contract: FileSystemWriter — file I/O operations.
 * Defined in domain, implemented in infrastructure.
 * Enables dry-run via NoOpFileSystem injection.
 *
 * @typedef {{
 *   writeFile: (path: string, data: Buffer|string) => Promise<void>,
 *   readFile: (path: string) => Promise<Buffer>,
 *   fileExists: (path: string) => Promise<boolean>,
 *   deleteFile: (path: string) => Promise<void>,
 *   ensureDir: (path: string) => Promise<void>,
 * }} FileSystemWriter
 */

/**
 * No-op implementation — used for dry-run mode.
 * Writes are ignored; reads return empty Buffer.
 * @returns {FileSystemWriter}
 */
export function createNoOpFileSystem() {
    return {
        async writeFile(_path, _data) { },
        async readFile(_path) { return Buffer.alloc(0); },
        async fileExists(_path) { return false; },
        async deleteFile(_path) { },
        async ensureDir(_path) { },
    };
}
