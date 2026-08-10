/**
 * @module application/info-use-case
 * @description InfoUseCase — fetches and returns package metadata.
 * ApplicationLogic layer — orchestrates contracts, no argv, no HTTP.
 *
 * CLI does not need to download the full package to display info.
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';
import { parseManifest } from '../domain/manifest.js';
import { resolveBestVersion } from '../domain/version.js';

/**
 * @typedef {{ packageName: string, version?: string, repository?: string }} InfoCommand
 */

/**
 * Execute package info lookup.
 * @param {InfoCommand} command
 * @param {{ repositoryIndex: import('../domain/contracts/repository-index.js').RepositoryIndex, manifestFetcher: import('../domain/contracts/manifest-fetcher.js').ManifestFetcher, configReader: import('../domain/contracts/config-reader.js').ConfigReader, config: import('../domain/contracts/config-reader.js').LlmpkgConfig }} deps
 * @returns {Promise<import('../domain/package.js').Package>}
 */
export async function execute(command, { repositoryIndex, manifestFetcher, configReader, config }) {
    const { packageName } = command;
    if (!packageName) {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'packageName is required.');
    }

    // Find available versions
    const versions = await repositoryIndex.getPackageVersions(packageName);
    if (!versions || versions.length === 0) {
        throw new LlmpkgError(
            ERROR_CODES.PACKAGE_NOT_FOUND,
            `Package "${packageName}" was not found in the repository.`,
        );
    }

    // Resolve which version to display
    const constraint = command.version ?? `^${versions.sort().at(-1)}`;
    const resolved = resolveBestVersion(versions, command.version ?? versions.sort().at(-1));
    if (!resolved) {
        throw new LlmpkgError(
            ERROR_CODES.VERSION_NOT_FOUND,
            `No version matching "${constraint}" found for "${packageName}".`,
        );
    }

    // Fetch manifest (by contract — doesn't know if it's HTTP or local)
    const repoConfig = config.repositories.find((r) => r.name === command.repository)
        ?? config.repositories[0]
        ?? { url: '' };

    const raw = await manifestFetcher.fetchManifest(packageName, resolved, repoConfig.url);

    if (!raw) {
        throw new LlmpkgError(
            ERROR_CODES.INVALID_MANIFEST,
            `Manifest for "${packageName}@${resolved}" could not be fetched.`,
        );
    }

    return parseManifest(raw, repoConfig.name ?? command.repository);
}
