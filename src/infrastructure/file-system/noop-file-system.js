/**
 * @module infrastructure/file-system/noop-file-system
 * @description No-op implementation of FileSystemWriter contract — used for dry-run mode.
 * Infrastructure layer.
 */

/**
 * No-op implementation — used for dry-run mode.
 * Writes are ignored; reads return empty Buffer.
 * @returns {import('../../domain/contracts/file-system.js').FileSystemWriter}
 */
export function createNoOpFileSystem() {
    return {
        async writeFile(_path, _data) { },
        async readFile(_path) { return Buffer.alloc(0); },
        async fileExists(_path) { return false; },
        async deleteFile(_path) { },
        async ensureDir(_path) { },
        async removeEmptyDir(_path) { return false; },
    };
}
