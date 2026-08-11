/**
 * @module cli/adapters/output/json-formatter
 * @description OutputAdapter (JSON) — formats domain results as JSON for machine consumption.
 * AdapterLayer — --json flag triggers this formatter (decided by CLI main, not by use cases).
 *
 * Use cases are completely unaware of --json mode.
 */

import { getSafeErrorMessage } from './error-mapper.js';

function sanitizeUrl(value) {
    try {
        const url = new URL(value);
        url.username = url.username ? '***' : '';
        url.password = '';
        return url.toString();
    } catch {
        return value;
    }
}

function safeRepository(repo) {
    return {
        name: repo.name,
        url: sanitizeUrl(repo.url),
        ...(repo.priority !== undefined ? { priority: repo.priority } : {}),
        ...(repo.authenticated || repo.username || repo.password ? { authenticated: true } : {}),
        ...(repo.global !== undefined ? { global: repo.global } : {}),
    };
}

/**
 * @param {{ packages: Array, totalCount: number }} result
 * @returns {string}
 */
export function formatSearchResultJson(result) {
    return JSON.stringify(result, null, 2);
}

/**
 * @param {import('../../../domain/package.js').Package} pkg
 * @returns {string}
 */
export function formatPackageInfoJson(pkg) {
    return JSON.stringify(pkg, null, 2);
}

/**
 * @param {{ installed: string[], lockfileEntry: object, dryRun: boolean }} result
 * @returns {string}
 */
export function formatInstallResultJson(result) {
    return JSON.stringify(result, null, 2);
}

/**
 * @param {{ removed: string[] }} result
 * @returns {string}
 */
export function formatUninstallResultJson(result) {
    return JSON.stringify(result, null, 2);
}

/**
 * @param {Array} records
 * @returns {string}
 */
export function formatInstalledListJson(records) {
    return JSON.stringify(records, null, 2);
}

/**
 * @param {{ name: string, url: string, global: boolean }} result
 * @returns {string}
 */
export function formatRepoAddResultJson(result) {
    return JSON.stringify(safeRepository(result), null, 2);
}

/**
 * @param {Array<{ name: string, url: string }>} repos
 * @returns {string}
 */
export function formatRepositoryListJson(repos) {
    return JSON.stringify(repos.map(safeRepository), null, 2);
}

/**
 * Format error as JSON. Intentionally excludes stack trace.
 * @param {Error} error
 * @returns {string}
 */
export function formatErrorJson(error) {
    return JSON.stringify({
        error: error.code ?? 'UNKNOWN_ERROR',
        message: getSafeErrorMessage(error),
    }, null, 2);
}
