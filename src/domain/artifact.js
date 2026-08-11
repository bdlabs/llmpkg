/**
 * @module artifact
 * @description Artifact domain model for llmpkg.
 * BusinessLogic layer — pure functions, no I/O.
 *
 * Path traversal is a domain security rule (not a UI concern):
 * artifact.path must not escape its package directory.
 */

import { LlmpkgError, ERROR_CODES } from './errors.js';

export const ARTIFACT_TYPES = Object.freeze([
    'skill',
    'prompt',
    'system-prompt',
    'agent-instructions',
    'rule',
    'workflow',
    'template',
    'schema',
    'knowledge',
    'documentation',
]);

/**
 * @typedef {{ id: string, type: string, path: string }} Artifact
 */

/**
 * Validate that a relative path does not escape its package root.
 * Domain rule — enforced here, not in the CLI parser.
 * @param {string} path
 * @returns {boolean}
 */
export function isPathSafe(path) {
    if (typeof path !== 'string' || !path) return false;
    const normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('/')) return false;
    if (normalized.startsWith('../')) return false;
    if (normalized === '..') return false;
    if (normalized.includes('/../')) return false;
    if (normalized.endsWith('/..')) return false;
    return true;
}

/**
 * Create and validate an Artifact.
 * @param {{ id: string, type: string, path: string }} params
 * @returns {Artifact}
 */
export function createArtifact({ id, type, path, installPath }) {
    if (!id || typeof id !== 'string') {
        throw new LlmpkgError(ERROR_CODES.INVALID_ARTIFACT, `Artifact id is required.`);
    }
    if (!isPathSafe(path)) {
        throw new LlmpkgError(
            ERROR_CODES.PATH_TRAVERSAL,
            `Artifact path "${path}" is unsafe — path traversal detected.`,
            { id, path },
        );
    }
    return Object.freeze({ id, type, path, installPath });
}
