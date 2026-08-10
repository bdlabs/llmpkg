/**
 * @module manifest
 * @description Manifest parsing and validation for llmpkg.
 * BusinessLogic layer — parses raw object into domain Package.
 * No I/O — receives a plain JS object (already fetched by infrastructure).
 */

import { LlmpkgError, ERROR_CODES } from './errors.js';
import { createPackage } from './package.js';
import { SUPPORTED_SCHEMA } from './version.js';

/**
 * Parse and validate a raw manifest object into a domain Package.
 * Throws LlmpkgError if the manifest is invalid or uses an unsupported schema version.
 * @param {object} raw - Plain JS object parsed from YAML/JSON manifest
 * @param {string} [repository] - Optional repository name to attach
 * @returns {import('./package.js').Package}
 */
export function parseManifest(raw, repository) {
    if (!raw || typeof raw !== 'object') {
        throw new LlmpkgError(ERROR_CODES.INVALID_MANIFEST, 'Manifest must be a non-null object.');
    }

    if (raw.schema !== SUPPORTED_SCHEMA) {
        const msg = raw.schema
            ? `Unsupported manifest schema: "${raw.schema}". Expected "${SUPPORTED_SCHEMA}".`
            : `Manifest is missing required field "schema". Expected "${SUPPORTED_SCHEMA}".`;
        throw new LlmpkgError(ERROR_CODES.INVALID_MANIFEST, msg, { found: raw.schema });
    }

    const requiredFields = ['name', 'version', 'artifacts'];
    for (const field of requiredFields) {
        if (raw[field] === undefined || raw[field] === null) {
            throw new LlmpkgError(
                ERROR_CODES.INVALID_MANIFEST,
                `Manifest is missing required field "${field}".`,
                { field },
            );
        }
    }

    return createPackage({
        name: raw.name,
        version: raw.version,
        description: raw.description ?? '',
        artifacts: (Array.isArray(raw.artifacts) ? raw.artifacts : []).map(a => ({
            ...a,
            path: `${raw.name}/${raw.version}/${a.path}`,
            installPath: `${raw.name}/${a.path}`
        })),
        dependencies: raw.dependencies ?? {},
        repository,
    });
}
