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
 *   removeEmptyDir: (path: string) => Promise<boolean>,
 * }} FileSystemWriter
 */


