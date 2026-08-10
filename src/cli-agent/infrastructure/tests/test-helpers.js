/**
 * @module infrastructure/tests/test-helpers
 * @description Helper functions for testing.
 */

import { createDefaultConfig } from '../../domain/contracts/config-reader.js';

export function createNullPackageStore() {
    const store = new Map();
    return {
        async saveInstallRecord(record) { store.set(record.name, record); },
        async getInstallRecord(name) { return store.get(name) ?? null; },
        async listInstalled() { return [...store.values()]; },
        async removeInstallRecord(name) { store.delete(name); },
    };
}

export function createNullArtifactDownloader() {
    return {
        async downloadArtifact(_artifact, _repoUrl) {
            return Buffer.alloc(0);
        },
    };
}

export function createNullRepositoryIndex() {
    return {
        async searchPackages(_query) { return []; },
        async getPackageVersions(_name) { return []; },
    };
}

export function createNullManifestFetcher() {
    return {
        async fetchManifest(_packageName, _version, _repoUrl) {
            return null;
        },
    };
}

export function createNullConfigReader(overrides = {}) {
    return {
        async readGlobalConfig() { return { ...createDefaultConfig(), ...overrides }; },
        async readProjectConfig() { return null; },
        async writeGlobalConfig(config) { },
        async writeProjectConfig(config) { },
    };
}
