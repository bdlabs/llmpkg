/**
 * @module contracts/repository-index
 * @description Contract: RepositoryIndex — finds packages in a repository.
 * Defined in domain, implemented in infrastructure.
 * ApplicationLogic depends on this interface, never on a concrete HTTP client.
 *
 * @typedef {{
 *   searchPackages: (query: string) => Promise<PackageEntry[]>,
 *   getPackageVersions: (name: string) => Promise<string[]>,
 * }} RepositoryIndex
 *
 * @typedef {{
 *   name: string,
 *   version: string,
 *   repository: string,
 *   description?: string,
 * }} PackageEntry
 */

/**
 * Null-object implementation for testing use cases without real infrastructure.
 * @returns {RepositoryIndex}
 */
export function createNullRepositoryIndex() {
    return {
        async searchPackages(_query) { return []; },
        async getPackageVersions(_name) { return []; },
    };
}
