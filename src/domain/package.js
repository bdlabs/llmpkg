/**
 * @module package
 * @description Package domain model for llmpkg.
 * BusinessLogic layer — pure validation, no I/O.
 */

import { LlmpkgError, ERROR_CODES } from './errors.js';
import { parseVersion } from './version.js';
import { createArtifact } from './artifact.js';

/**
 * @typedef {{
 *   name: string,
 *   version: string,
 *   description: string,
 *   artifacts: import('./artifact.js').Artifact[],
 *   dependencies: Record<string, string>,
 *   repository?: string,
 * }} Package
 */

/**
 * Create and validate a Package domain object.
 * @param {{ name: string, version: string, description?: string, artifacts: object[], dependencies?: Record<string,string>, repository?: string }} params
 * @returns {Package}
 */
export function createPackage({ name, version, description = '', artifacts = [], dependencies = {}, repository }) {
    if (!name || typeof name !== 'string') {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Package name is required.');
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
        throw new LlmpkgError(
            ERROR_CODES.INVALID_PACKAGE,
            `Package name "${name}" is invalid. Use lowercase letters, numbers, and hyphens only.`,
        );
    }

    // Validate version — throws if invalid
    parseVersion(version);

    if (!Array.isArray(artifacts)) {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'artifacts must be an array.');
    }

    const validatedArtifacts = artifacts.map((a) => createArtifact(a));

    if (typeof dependencies !== 'object' || Array.isArray(dependencies)) {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'dependencies must be an object.');
    }

    return Object.freeze({
        name,
        version,
        description,
        artifacts: validatedArtifacts,
        dependencies,
        repository: repository ?? null,
    });
}
