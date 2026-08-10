/**
 * @module cli/adapters/output/text-formatter
 * @description OutputAdapter (text) — formats domain results as human-readable text.
 * AdapterLayer — knows only the Result shape, NOT use case logic.
 *
 * TechnicalLeakage prevention: formatError hides stack traces and raw infra errors.
 */

const COL_NAME = 24;
const COL_VERSION = 12;
const COL_REPO = 16;

function pad(str, width) {
    return String(str ?? '').padEnd(width);
}

/**
 * Format search results as a table.
 * @param {{ packages: Array<{ name: string, version: string, repository: string, description?: string }>, totalCount: number }} result
 * @returns {string}
 */
export function formatSearchResult(result) {
    if (!result.packages || result.packages.length === 0) {
        return 'No packages found.';
    }
    const header = `${pad('NAME', COL_NAME)}${pad('VERSION', COL_VERSION)}${'REPOSITORY'}`;
    const separator = '-'.repeat(COL_NAME + COL_VERSION + COL_REPO);
    const rows = result.packages.map(
        (p) => `${pad(p.name, COL_NAME)}${pad(p.version, COL_VERSION)}${p.repository ?? ''}`,
    );
    return [header, separator, ...rows].join('\n');
}

/**
 * Format package info.
 * @param {import('../../../domain/package.js').Package} pkg
 * @returns {string}
 */
export function formatPackageInfo(pkg) {
    const lines = [
        `${pkg.name}`,
        `  version:    ${pkg.version}`,
        `  repository: ${pkg.repository ?? 'unknown'}`,
        `  description: ${pkg.description || '(none)'}`,
        '',
        '  Artifacts:',
        ...pkg.artifacts.map((a) => `    ${a.type.padEnd(20)} ${a.id}  →  ${a.path}`),
    ];

    const deps = Object.entries(pkg.dependencies ?? {});
    if (deps.length > 0) {
        lines.push('', '  Dependencies:');
        for (const [name, constraint] of deps) {
            lines.push(`    ${name}  ${constraint}`);
        }
    }

    return lines.join('\n');
}

/**
 * Format install result.
 * @param {{ installed: string[], lockfileEntry: object, dryRun: boolean }} result
 * @returns {string}
 */
export function formatInstallResult(result) {
    const prefix = result.dryRun ? '[dry-run] Would install:' : 'Installed:';
    if (result.installed.length === 0) return `${prefix} (nothing to install)`;
    return [prefix, ...result.installed.map((f) => `  ${f}`)].join('\n');
}

/**
 * Format uninstall result.
 * @param {{ removed: string[] }} result
 * @returns {string}
 */
export function formatUninstallResult(result) {
    if (result.removed.length === 0) return 'No files removed.';
    return ['Removed:', ...result.removed.map((f) => `  ${f}`)].join('\n');
}

/**
 * Format a list of installed packages.
 * @param {Array<{ name: string, version: string, repository: string }>} records
 * @returns {string}
 */
export function formatInstalledList(records) {
    if (records.length === 0) return 'No packages installed.';
    const header = `${pad('NAME', COL_NAME)}${pad('VERSION', COL_VERSION)}${'REPOSITORY'}`;
    const separator = '-'.repeat(COL_NAME + COL_VERSION + COL_REPO);
    const rows = records.map((r) => `${pad(r.name, COL_NAME)}${pad(r.version, COL_VERSION)}${r.repository ?? ''}`);
    return [header, separator, ...rows].join('\n');
}

/**
 * Format repository add result.
 * @param {{ name: string, url: string, global: boolean }} result
 * @returns {string}
 */
export function formatRepoAddResult(result) {
    const scope = result.global ? 'global config (~/.config/llmpkg/config.json)' : 'project config (llmpkg.json)';
    return `Added repository '${result.name}' (${result.url}) to ${scope}.`;
}

/**
 * Format an error for human display.
 * Hides stack traces and raw technical details — TechnicalLeakage prevention.
 * @param {Error} error
 * @returns {string}
 */
export function formatError(error) {
    const code = error.code ? ` [${error.code}]` : '';
    return `Error${code}: ${error.message}`;
}
