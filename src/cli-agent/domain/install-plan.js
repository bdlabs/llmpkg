/**
 * @module install-plan
 * @description Install plan — domain model for a pending installation.
 * BusinessLogic layer — pure logic, no I/O.
 *
 * Domain rules:
 * - Artifact paths must not escape the target directory (path traversal).
 * - Plan is validated before any file is written.
 */

import { resolve, join, sep } from 'node:path';
import { LlmpkgError, ERROR_CODES } from './errors.js';
import { isPathSafe } from './artifact.js';

/**
 * @typedef {{ artifactId: string, sourcePath: string, targetPath: string }} InstallEntry
 * @typedef {{ targetDir: string, entries: InstallEntry[], validate: () => void, getInstallPaths: () => Map<string, string> }} InstallPlan
 */

/**
 * Create an install plan.
 * @param {{ artifacts: import('./artifact.js').Artifact[], targetDir: string }} params
 * @returns {InstallPlan}
 */
export function createInstallPlan({ artifacts, targetDir }) {
    if (!targetDir || typeof targetDir !== 'string') {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'targetDir is required for install plan.');
    }
    if (!Array.isArray(artifacts)) {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'artifacts must be an array.');
    }

    const resolvedTarget = resolve(targetDir);

    const entries = artifacts.map((artifact) => {
        const targetPath = join(resolvedTarget, artifact.path);
        return {
            artifactId: artifact.id,
            sourcePath: artifact.path,
            targetPath,
        };
    });

    function validate() {
        const targetPrefix = resolvedTarget + sep;
        for (const entry of entries) {
            if (!entry.targetPath.startsWith(targetPrefix) && entry.targetPath !== resolvedTarget) {
                throw new LlmpkgError(
                    ERROR_CODES.PATH_TRAVERSAL,
                    `Artifact "${entry.artifactId}" path escapes the target directory.`,
                    { artifactId: entry.artifactId, targetPath: entry.targetPath, targetDir: resolvedTarget },
                );
            }
            if (!isPathSafe(entry.sourcePath)) {
                throw new LlmpkgError(
                    ERROR_CODES.PATH_TRAVERSAL,
                    `Artifact "${entry.artifactId}" has an unsafe source path.`,
                    { artifactId: entry.artifactId, sourcePath: entry.sourcePath },
                );
            }
        }
    }

    function getInstallPaths() {
        const map = new Map();
        for (const entry of entries) {
            map.set(entry.artifactId, entry.targetPath);
        }
        return map;
    }

    return { targetDir: resolvedTarget, entries, validate, getInstallPaths };
}
