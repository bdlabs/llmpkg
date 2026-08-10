/**
 * @module infrastructure/transport/local-fs-transport
 * @description Local filesystem implementations of RepositoryIndex and ManifestFetcher.
 * Infrastructure layer — for local repos and testing without HTTP.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

/**
 * Read and parse a JSON file, returning null if not found.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readJsonFile(filePath) {
    try {
        const text = await readFile(filePath, 'utf8');
        return JSON.parse(text);
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `Cannot read ${filePath}: ${err.message}`);
    }
}

/**
 * Local filesystem implementation of RepositoryIndex.
 * Expects: {basePath}/registry.json with { packages: [...] }
 * @param {string} basePath
 * @returns {import('../../domain/contracts/repository-index.js').RepositoryIndex}
 */
export function createLocalFsRepositoryIndex(basePath) {
    async function getRegistry() {
        const registry = await readJsonFile(join(basePath, 'registry.json'));
        if (!registry) {
            throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `registry.json not found in ${basePath}`);
        }
        return registry;
    }

    return {
        async searchPackages(query) {
            const registry = await getRegistry();
            const packages = Array.isArray(registry.packages) ? registry.packages : [];
            const q = query.toLowerCase();
            return packages
                .filter((p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
                .map((p) => ({
                    name: p.name,
                    version: p.latestVersion ?? p.version ?? '0.0.0',
                    repository: 'local',
                    description: p.description ?? '',
                }));
        },

        async getPackageVersions(packageName) {
            const registry = await getRegistry();
            const packages = Array.isArray(registry.packages) ? registry.packages : [];
            const found = packages.find((p) => p.name === packageName);
            if (!found) return [];
            return Array.isArray(found.versions) ? found.versions : [found.version ?? found.latestVersion].filter(Boolean);
        },
    };
}

/**
 * Local filesystem implementation of ManifestFetcher.
 * Expects: {basePath}/packages/{name}/{version}/manifest.json
 * @param {string} basePath
 * @returns {import('../../domain/contracts/manifest-fetcher.js').ManifestFetcher}
 */
export function createLocalFsManifestFetcher(basePath) {
    return {
        async fetchManifest(packageName, version, _repoUrl) {
            const manifestPath = join(basePath, 'packages', packageName, version, 'manifest.json');
            return readJsonFile(manifestPath);
        },
    };
}

/**
 * Local filesystem implementation of ArtifactDownloader.
 * @param {string} basePath
 * @returns {import('../../domain/contracts/artifact-downloader.js').ArtifactDownloader}
 */
export function createLocalFsArtifactDownloader(basePath) {
    return {
        async downloadArtifact(artifact, _repoUrl) {
            const filePath = join(basePath, artifact.path);
            try {
                return await readFile(filePath);
            } catch (err) {
                throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `Artifact file not found: ${filePath}`);
            }
        },
    };
}
