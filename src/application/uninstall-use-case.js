/**
 * @module application/uninstall-use-case
 * @description UninstallUseCase — removes a package and cleans up install records.
 * ApplicationLogic layer — no argv, no direct file I/O.
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';

/**
 * @typedef {{ packageName: string }} UninstallCommand
 * @typedef {{ removed: string[] }} UninstallResult
 */

/**
 * Execute package uninstall.
 * @param {UninstallCommand} command
 * @param {{ packageStore: import('../domain/contracts/package-store.js').PackageStore, fileSystem: import('../domain/contracts/file-system.js').FileSystemWriter }} deps
 * @returns {Promise<UninstallResult>}
 */
export async function execute(command, { packageStore, fileSystem }) {
    const { packageName } = command;
    if (!packageName) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'packageName is required.');

    const record = await packageStore.getInstallRecord(packageName);
    if (!record) {
        throw new LlmpkgError(
            ERROR_CODES.PACKAGE_NOT_FOUND,
            `Package "${packageName}" is not installed.`,
        );
    }

    const removed = [];
    const dirsToCheck = new Set();

    for (const filePath of (record.files ?? [])) {
        const exists = await fileSystem.fileExists(filePath);
        if (exists) {
            await fileSystem.deleteFile(filePath);
            removed.push(filePath);
        }

        let dirPath = filePath.replace(/[/\\][^/\\]+$/, '');
        dirsToCheck.add(dirPath);
    }

    // Try to remove empty dirs iteratively up the tree
    const dirsArray = Array.from(dirsToCheck).sort((a, b) => b.length - a.length);
    for (let dir of dirsArray) {
        let currentDir = dir;
        while (currentDir) {
            const wasRemoved = await fileSystem.removeEmptyDir(currentDir);
            if (!wasRemoved) break;

            const parent = currentDir.replace(/[/\\][^/\\]+$/, '');
            if (parent === currentDir) break;
            currentDir = parent;
        }
    }

    await packageStore.removeInstallRecord(packageName);

    return { removed };
}
