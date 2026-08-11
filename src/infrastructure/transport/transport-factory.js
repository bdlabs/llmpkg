/**
 * @module infrastructure/transport/transport-factory
 * @description Factory for creating appropriate transport implementations based on repo URL.
 */

import { createHttpRepositoryIndex, createHttpManifestFetcher, createHttpArtifactDownloader } from './http-transport.js';
import { createLocalFsRepositoryIndex, createLocalFsManifestFetcher, createLocalFsArtifactDownloader } from './local-fs-transport.js';
import { createGitHubRepositoryIndex, createGitHubManifestFetcher, createGitHubArtifactDownloader } from './github-transport.js';
import { createGitRepositoryIndex, createGitManifestFetcher, createGitArtifactDownloader } from './git-transport.js';

export function getTransportType(url) {
    if (!url) return 'http'; // Default
    if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('./') || url.startsWith('.\\') || url.match(/^[a-zA-Z]:\\/)) {
        return 'local';
    }
    if (url.startsWith('github:') || url.startsWith('https://github.com/')) {
        return 'github';
    }
    const scpLike = !url.includes('://') && /^(?:[^/@\s:]+@)?[^/:\s]+:.+/.test(url);
    if (url.startsWith('ssh://') || url.startsWith('git://') || scpLike || /\.git\/?$/.test(url)) {
        return 'git';
    }
    return 'http';
}

export function createRepositoryIndex(repoConfig) {
    const type = getTransportType(repoConfig.url);
    if (type === 'local') return createLocalFsRepositoryIndex(repoConfig);
    if (type === 'github') return createGitHubRepositoryIndex(repoConfig);
    if (type === 'git') return createGitRepositoryIndex(repoConfig);
    return createHttpRepositoryIndex(repoConfig);
}

function repositoryConfigs(config) {
    if (Array.isArray(config)) return config;
    return config ? [config] : [];
}

export function findRepository(config, repoUrl) {
    return repositoryConfigs(config).find((repo) => repo.url === repoUrl) ?? { url: repoUrl, name: 'unknown' };
}

export function createManifestFetcher(config) {
    // Return a facade that selects the right transport based on repoUrl inside the method
    const http = createHttpManifestFetcher();
    const local = createLocalFsManifestFetcher();
    const github = createGitHubManifestFetcher();

    return {
        async fetchManifest(packageName, version, repoUrl) {
            const type = getTransportType(repoUrl);
            if (type === 'local') return local.fetchManifest(packageName, version, repoUrl);
            if (type === 'github') return github.fetchManifest(packageName, version, repoUrl);
            if (type === 'git') return createGitManifestFetcher(findRepository(config, repoUrl)).fetchManifest(packageName, version, repoUrl);
            return http.fetchManifest(packageName, version, repoUrl);
        }
    };
}

export function createArtifactDownloader(config) {
    // Facade selecting the right transport based on repoUrl
    const http = createHttpArtifactDownloader();
    const local = createLocalFsArtifactDownloader();
    const github = createGitHubArtifactDownloader();

    return {
        async downloadArtifact(artifact, repoUrl) {
            const type = getTransportType(repoUrl);
            if (type === 'local') return local.downloadArtifact(artifact, repoUrl);
            if (type === 'github') return github.downloadArtifact(artifact, repoUrl);
            if (type === 'git') return createGitArtifactDownloader(findRepository(config, repoUrl)).downloadArtifact(artifact, repoUrl);
            return http.downloadArtifact(artifact, repoUrl);
        }
    };
}
