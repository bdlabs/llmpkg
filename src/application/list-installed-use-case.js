/**
 * @module application/list-installed-use-case
 * @description ListInstalledUseCase — lists all installed packages.
 * ApplicationLogic layer — orchestrates package store retrieval.
 */

/**
 * Execute list installed.
 * @param {object} command
 * @param {{ packageStore: import('../domain/contracts/package-store.js').PackageStore }} deps
 * @returns {Promise<Array<{ name: string, version: string, repository: string }>>}
 */
export async function execute(command, { packageStore }) {
    return packageStore.listInstalled();
}
