/**
 * @module contracts/package-store
 * @description Contract: PackageStore — persists installation state.
 * Defined in domain, implemented in infrastructure (JSON file, SQLite, etc.).
 *
 * @typedef {{
 *   name: string,
 *   version: string,
 *   repository: string,
 *   installedAt: string,
 *   files: string[],
 *   integrity?: string,
 * }} InstallRecord
 *
 * @typedef {{
 *   saveInstallRecord: (record: InstallRecord) => Promise<void>,
 *   getInstallRecord: (name: string) => Promise<InstallRecord|null>,
 *   listInstalled: () => Promise<InstallRecord[]>,
 *   removeInstallRecord: (name: string) => Promise<void>,
 * }} PackageStore
 */

/**
 * Null-object implementation for tests.
 * @returns {PackageStore}
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
