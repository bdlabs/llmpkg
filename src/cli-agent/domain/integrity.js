/**
 * @module integrity
 * @description SHA-256 integrity verification — domain rule.
 * BusinessLogic layer — pure computation, no I/O.
 * Receives data as Buffer/string, returns hash. Never reads from disk.
 */

import { createHash } from 'node:crypto';
import { LlmpkgError, ERROR_CODES } from './errors.js';

/**
 * Compute SHA-256 hex digest of the given data.
 * @param {Buffer|string} data
 * @returns {string} hex string, e.g. "sha256:abc123..."
 */
export function computeHash(data) {
    const hash = createHash('sha256').update(data).digest('hex');
    return `sha256:${hash}`;
}

/**
 * Verify that data matches the expected hash.
 * Domain rule: if hashes do not match, installation must be aborted.
 * @param {Buffer|string} data
 * @param {string} expectedHash - e.g. "sha256:abc123..."
 * @returns {boolean}
 */
export function verifyIntegrity(data, expectedHash) {
    if (!expectedHash || typeof expectedHash !== 'string') return false;
    const actual = computeHash(data);
    return actual === expectedHash;
}

/**
 * Assert integrity — throws INTEGRITY_ERROR if hash does not match.
 * @param {Buffer|string} data
 * @param {string} expectedHash
 * @param {string} [context] - identifier for error message
 */
export function assertIntegrity(data, expectedHash, context = '') {
    if (!verifyIntegrity(data, expectedHash)) {
        throw new LlmpkgError(
            ERROR_CODES.INTEGRITY_ERROR,
            `Integrity check failed${context ? ` for "${context}"` : ''}.`,
            { expected: expectedHash },
        );
    }
}
