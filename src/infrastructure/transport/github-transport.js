/**
 * @module infrastructure/transport/github-transport
 * @description GitHub implementations of RepositoryIndex and ManifestFetcher.
 * Allows using a GitHub repository directly as a registry via github:owner/repo
 */

import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

/**
 * Parses url "github:owner/repo" or "https://github.com/owner/repo"
 * into a raw.githubusercontent.com base URL for the 'main' branch.
 * @param {string} url
 * @returns {string}
 */
function getGitHubRawBase(url) {
    let owner, repo;
    if (url.startsWith('github:')) {
        [owner, repo] = url.slice(7).split('/');
    } else if (url.startsWith('https://github.com/')) {
        [owner, repo] = url.slice(19).split('/');
    }
    if (!owner || !repo) {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `Invalid GitHub repository format: ${url}`);
    }
    repo = repo.replace(/\.git$/, '');
    return `https://raw.githubusercontent.com/${owner}/${repo}/main`;
}

/**
 * Fetch JSON from GitHub raw URL.
 */
async function fetchJson(url) {
    let res;
    try {
        res = await fetch(url);
    } catch (err) {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `Network error fetching ${url}: ${err.message}`);
    }
    if (!res.ok) {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `HTTP ${res.status} fetching ${url}`);
    }
    return res.json();
}

/**
 * GitHub implementation of RepositoryIndex.
 * Expects: registry.json on the main branch.
 * @param {{ name: string, url: string }} repoConfig
 * @returns {import('../../domain/contracts/repository-index.js').RepositoryIndex}
 */
export function createGitHubRepositoryIndex(repoConfig) {
    const basePath = getGitHubRawBase(repoConfig.url);

    async function getRegistry() {
        return fetchJson(`${basePath}/registry.json`);
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
                    repository: repoConfig.name,
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
 * GitHub implementation of ManifestFetcher.
 * @returns {import('../../domain/contracts/manifest-fetcher.js').ManifestFetcher}
 */
export function createGitHubManifestFetcher() {
    return {
        async fetchManifest(packageName, version, repoUrl) {
            const basePath = getGitHubRawBase(repoUrl);
            const url = `${basePath}/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/manifest.json`;
            return fetchJson(url);
        },
    };
}

/**
 * GitHub implementation of ArtifactDownloader.
 * @returns {import('../../domain/contracts/artifact-downloader.js').ArtifactDownloader}
 */
export function createGitHubArtifactDownloader() {
    return {
        async downloadArtifact(artifact, repoUrl) {
            const basePath = getGitHubRawBase(repoUrl);
            const url = `${basePath}/packages/${encodeURIComponent(artifact.path)}`;
            let res;
            try {
                res = await fetch(url);
            } catch (err) {
                throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `Download failed: ${err.message}`);
            }
            if (!res.ok) {
                throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, `HTTP ${res.status} downloading ${artifact.id}`);
            }
            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer);
        },
    };
}
