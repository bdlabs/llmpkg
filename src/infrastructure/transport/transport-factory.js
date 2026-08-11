/**
 * @module infrastructure/transport/transport-factory
 * @description Factory for creating appropriate transport implementations based on repo URL.
 */

import { createHttpRepositoryIndex, createHttpManifestFetcher, createHttpArtifactDownloader } from './http-transport.js';
import { createLocalFsRepositoryIndex, createLocalFsManifestFetcher, createLocalFsArtifactDownloader } from './local-fs-transport.js';
import { createGitHubRepositoryIndex, createGitHubManifestFetcher, createGitHubArtifactDownloader } from './github-transport.js';

function getTransportType(url) {
    if (!url) return 'http'; // Default
    if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('./') || url.startsWith('.\\') || url.match(/^[a-zA-Z]:\\/)) {
        return 'local';
    }
    if (url.startsWith('github:') || url.startsWith('https://github.com/')) {
        return 'github';
    }
    return 'http';
}

export function createRepositoryIndex(repoConfig) {
    const type = getTransportType(repoConfig.url);
    if (type === 'local') return createLocalFsRepositoryIndex(repoConfig);
    if (type === 'github') return createGitHubRepositoryIndex(repoConfig);
    return createHttpRepositoryIndex(repoConfig);
}

export function createManifestFetcher() {
    // Return a facade that selects the right transport based on repoUrl inside the method
    const http = createHttpManifestFetcher();
    const local = createLocalFsManifestFetcher();
    const github = createGitHubManifestFetcher();

    return {
        async fetchManifest(packageName, version, repoUrl) {
            const type = getTransportType(repoUrl);
            if (type === 'local') return local.fetchManifest(packageName, version, repoUrl);
            if (type === 'github') return github.fetchManifest(packageName, version, repoUrl);
            return http.fetchManifest(packageName, version, repoUrl);
        }
    };
}

export function createArtifactDownloader() {
    // Facade selecting the right transport based on repoUrl
    const http = createHttpArtifactDownloader();
    const local = createLocalFsArtifactDownloader();
    const github = createGitHubArtifactDownloader();

    return {
        async downloadArtifact(artifact, repoUrl) {
            const type = getTransportType(repoUrl);
            if (type === 'local') return local.downloadArtifact(artifact, repoUrl);
            if (type === 'github') return github.downloadArtifact(artifact, repoUrl);
            return http.downloadArtifact(artifact, repoUrl);
        }
    };
}
