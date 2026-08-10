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
    for (const filePath of (record.files ?? [])) {
        const exists = await fileSystem.fileExists(filePath);
        if (exists) {
            await fileSystem.deleteFile(filePath);
            removed.push(filePath);
        }
    }

    await packageStore.removeInstallRecord(packageName);

    return { removed };
}
