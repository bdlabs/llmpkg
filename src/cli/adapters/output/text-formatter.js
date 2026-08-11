/**
 * @module cli/adapters/output/text-formatter
 * @description OutputAdapter (text) — formats domain results as human-readable text.
 * AdapterLayer — knows only the Result shape, NOT use case logic.
 *
 * TechnicalLeakage prevention: formatError hides stack traces and raw infra errors.
 */

import { getSafeErrorMessage } from './error-mapper.js';
import { theme } from './theme.js';

const COL_NAME = 24;
const COL_VERSION = 12;
const COL_REPO = 16;

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
        return theme.warning('No packages found.');
    }
    const header = theme.label(`${pad('NAME', COL_NAME)}${pad('VERSION', COL_VERSION)}${'REPOSITORY'}`);
    const separator = theme.muted('-'.repeat(COL_NAME + COL_VERSION + COL_REPO));
    const rows = result.packages.map(
        (p) => `${theme.value(pad(p.name, COL_NAME))}${theme.value(pad(p.version, COL_VERSION))}${theme.muted(p.repository ?? '')}`,
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
        `${theme.primary(pkg.name)}`,
        `  ${theme.label('version:   ')} ${theme.value(pkg.version)}`,
        `  ${theme.label('repository:')} ${theme.muted(pkg.repository ?? 'unknown')}`,
        `  ${theme.label('description:')} ${theme.value(pkg.description || '(none)')}`,
        '',
        `  ${theme.label('Artifacts:')}`,
        ...pkg.artifacts.map((a) => `    ${theme.muted(a.type.padEnd(20))} ${theme.value(a.id)}  →  ${theme.muted(a.path)}`),
    ];

    const deps = Object.entries(pkg.dependencies ?? {});
    if (deps.length > 0) {
        lines.push('', `  ${theme.label('Dependencies:')}`);
        for (const [name, constraint] of deps) {
            lines.push(`    ${theme.value(name)}  ${theme.muted(constraint)}`);
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
    const prefix = result.dryRun ? theme.warning('[dry-run] Would install:') : `${theme.iconSuccess()} ${theme.success('Installed:')}`;
    if (result.installed.length === 0) return `${prefix} ${theme.muted('(nothing to install)')}`;
    return [prefix, ...result.installed.map((f) => `  ${theme.value(f)}`)].join('\n');
}

/**
 * Format uninstall result.
 * @param {{ removed: string[] }} result
 * @returns {string}
 */
export function formatUninstallResult(result) {
    if (result.removed.length === 0) return theme.warning('No files removed.');
    return [`${theme.iconSuccess()} ${theme.success('Removed:')}`, ...result.removed.map((f) => `  ${theme.value(f)}`)].join('\n');
}

/**
 * Format a list of installed packages.
 * @param {Array<{ name: string, version: string, repository: string }>} records
 * @returns {string}
 */
export function formatInstalledList(records) {
    if (records.length === 0) return theme.warning('No packages installed.');
    const header = theme.label(`${pad('NAME', COL_NAME)}${pad('VERSION', COL_VERSION)}${'REPOSITORY'}`);
    const separator = theme.muted('-'.repeat(COL_NAME + COL_VERSION + COL_REPO));
    const rows = records.map((r) => `${theme.value(pad(r.name, COL_NAME))}${theme.value(pad(r.version, COL_VERSION))}${theme.muted(r.repository ?? '')}`);
    return [header, separator, ...rows].join('\n');
}

/**
 * Format repository add result.
 * @param {{ name: string, url: string, global: boolean }} result
 * @returns {string}
 */
export function formatRepoAddResult(result) {
    const scope = result.global ? 'global config (~/.config/llmpkg/config.json)' : 'project config (.llmpkg/llmpkg.json)';
    return `${theme.iconSuccess()} ${theme.success('Added repository')} ${theme.value(`'${result.name}'`)} ${theme.muted(`(${sanitizeUrl(result.url)})`)} to ${theme.muted(scope)}.`;
}

/**
 * Format a list of configured repositories.
 * @param {Array<{ name: string, url: string }>} repos
 * @returns {string}
 */
export function formatRepositoryList(repos) {
    if (repos.length === 0) return theme.warning('No repositories configured.');
    return repos.map((r) => `${theme.value(r.name)}  ${theme.muted(sanitizeUrl(r.url))}${r.username || r.password ? theme.muted('  [authenticated]') : ''}`).join('\n');
}

/** Format safe repository warnings for stderr. */
export function formatRepoWarnings(result) {
    return (result.warnings ?? []).map((warning) => theme.warning(`Warning: ${warning}`)).join('\n');
}

/**
 * Format an error for human display.
 * Hides stack traces and raw technical details — TechnicalLeakage prevention.
 * @param {Error} error
 * @returns {string}
 */
export function formatError(error) {
    const code = error.code ? theme.muted(` [${error.code}]`) : '';
    const msg = getSafeErrorMessage(error);

    return `${theme.iconError()} ${theme.error('Error')}${code}: ${theme.value(msg)}`;
}
