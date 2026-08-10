/**
 * @module infrastructure/transport/http-transport
 * @description HTTP implementations of RepositoryIndex and ManifestFetcher contracts.
 * Infrastructure layer — knows HTTP, knows URLs. Domain does NOT import this.
 *
 * Discovery protocol:
 *   1. GET {repoUrl}/.well-known/llmpkg.json → { protocol, index }
 *   2. GET index URL → registry.json with package list
 *   3. GET manifest: {repoUrl}/packages/{name}/{version}/manifest.json
 */

import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

/**
 * Minimal YAML→JS parser for simple flat key-value manifests.
 * Does not support nested structures or arrays (use JSON manifests in practice).
 * @param {string} text
 * @returns {object}
 */
function parseSimpleYaml(text) {
    const result = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        result[key] = value;
    }
    return result;
}

/**
 * Fetch JSON or simple-YAML from a URL using Node.js built-in fetch.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function fetchJson(url) {
    let res;
    try {
        res = await fetch(url);
    } catch (err) {
        throw new LlmpkgError(
            ERROR_CODES.REPOSITORY_UNAVAILABLE,
            `Network error fetching ${url}: ${err.message}`,
        );
    }
    if (!res.ok) {
        throw new LlmpkgError(
            ERROR_CODES.REPOSITORY_UNAVAILABLE,
            `HTTP ${res.status} fetching ${url}`,
        );
    }
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (contentType.includes('application/json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
        return JSON.parse(text);
    }
    return parseSimpleYaml(text);
}

/**
 * Resolve the registry index URL for a repository.
 * @param {string} repoUrl
 * @returns {Promise<string>} index URL
 */
async function resolveIndexUrl(repoUrl) {
    const base = repoUrl.replace(/\/$/, '');
    try {
        const wellKnown = await fetchJson(`${base}/.well-known/llmpkg.json`);
        if (wellKnown.index) {
            return wellKnown.index.startsWith('http') ? wellKnown.index : `${base}${wellKnown.index}`;
        }
    } catch {
        // Fall through to default
    }
    return `${base}/registry.json`;
}

/**
 * HTTP implementation of RepositoryIndex.
 * @param {{ name: string, url: string, priority?: number }} repoConfig
 * @returns {import('../../domain/contracts/repository-index.js').RepositoryIndex}
 */
export function createHttpRepositoryIndex(repoConfig) {
    const base = repoConfig.url.replace(/\/$/, '');

    async function getRegistry() {
        const indexUrl = await resolveIndexUrl(base);
        return fetchJson(indexUrl);
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
 * HTTP implementation of ManifestFetcher.
 * @returns {import('../../domain/contracts/manifest-fetcher.js').ManifestFetcher}
 */
export function createHttpManifestFetcher() {
    return {
        async fetchManifest(packageName, version, repoUrl) {
            const base = repoUrl.replace(/\/$/, '');
            const url = `${base}/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/manifest.json`;
            return fetchJson(url);
        },
    };
}

/**
 * HTTP implementation of ArtifactDownloader.
 * @returns {import('../../domain/contracts/artifact-downloader.js').ArtifactDownloader}
 */
export function createHttpArtifactDownloader() {
    return {
        async downloadArtifact(artifact, repoUrl) {
            const base = repoUrl.replace(/\/$/, '');
            const encodedPath = artifact.path.split('/').map(encodeURIComponent).join('/');
            const url = `${base}/packages/${encodedPath}`;
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
