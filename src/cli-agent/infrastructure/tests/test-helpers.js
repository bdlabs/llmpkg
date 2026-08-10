/**
 * @module infrastructure/tests/test-helpers
 * @description Helper functions for testing.
 */

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
