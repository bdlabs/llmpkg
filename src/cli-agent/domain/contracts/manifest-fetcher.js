/**
 * @module contracts/manifest-fetcher
 * @description Contract: ManifestFetcher — fetches a package manifest from a repository.
 * Defined in domain, implemented in infrastructure (HTTP, local-fs, Git).
 *
 * @typedef {{
 *   fetchManifest: (packageName: string, version: string, repoUrl: string) => Promise<object>,
 * }} ManifestFetcher
 */

/**
 * Null-object implementation — returns a minimal valid manifest structure.
 * @returns {ManifestFetcher}
 */
export function createNullManifestFetcher() {
    return {
        async fetchManifest(_packageName, _version, _repoUrl) {
            return null;
        },
    };
}
