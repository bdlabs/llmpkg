/**
 * @module version
 * @description Semantic versioning domain logic for llmpkg.
 * BusinessLogic layer — pure functions, no I/O, no imports from upper layers.
 *
 * Rules:
 * - Versions follow SemVer: MAJOR.MINOR.PATCH
 * - Supported constraint operators: ^ (compatible), ~ (patch), exact
 */

import { LlmpkgError, ERROR_CODES } from './errors.js';

export const SUPPORTED_SCHEMA = 'llmpkg/v1';

/**
 * @typedef {{ major: number, minor: number, patch: number }} ParsedVersion
 */

/**
 * Parse a version string into its numeric components.
 * @param {string} str - e.g. "1.2.3"
 * @returns {ParsedVersion}
 */
export function parseVersion(str) {
    if (typeof str !== 'string' || !str) {
        throw new LlmpkgError(ERROR_CODES.INVALID_MANIFEST, `Invalid version: "${str}"`);
    }
    const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(str.trim());
    if (!match) {
        throw new LlmpkgError(
            ERROR_CODES.INVALID_MANIFEST,
            `Version "${str}" does not follow semantic formatting (expected numbers separated by dots).`,
        );
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2] || 0),
        patch: Number(match[3] || 0),
    };
}

/**
 * Compare two version strings.
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareVersions(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
    if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
    if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
    return 0;
}

/**
 * Check whether `version` satisfies `constraint`.
 * Supports: "1.2.3" (exact), "^1.2.3" (compatible major), "~1.2.3" (compatible minor)
 * @param {string} version
 * @param {string} constraint
 * @returns {boolean}
 */
export function satisfiesConstraint(version, constraint) {
    if (typeof constraint !== 'string') return false;
    const c = constraint.trim();

    if (c.startsWith('^')) {
        const base = parseVersion(c.slice(1));
        const v = parseVersion(version);
        if (v.major !== base.major) return false;
        if (v.minor < base.minor) return false;
        if (v.minor === base.minor && v.patch < base.patch) return false;
        return true;
    }

    if (c.startsWith('~')) {
        const base = parseVersion(c.slice(1));
        const v = parseVersion(version);
        if (v.major !== base.major) return false;
        if (v.minor !== base.minor) return false;
        return v.patch >= base.patch;
    }

    // Exact
    return compareVersions(version, c) === 0;
}

/**
 * Find the best matching version from a list given a constraint.
 * @param {string[]} versions
 * @param {string} constraint
 * @returns {string|null}
 */
export function resolveBestVersion(versions, constraint) {
    const matching = versions.filter((v) => satisfiesConstraint(v, constraint));
    if (matching.length === 0) return null;
    return matching.sort((a, b) => -compareVersions(a, b))[0];
}
