/**
 * @module contracts/artifact-downloader
 * @description Contract: ArtifactDownloader — downloads artifact file content.
 * Defined in domain, implemented in infrastructure.
 *
 * @typedef {{
 *   downloadArtifact: (artifact: import('../artifact.js').Artifact, repoUrl: string) => Promise<Buffer>,
 * }} ArtifactDownloader
 */

/**
 * Null-object implementation — returns an empty Buffer.
 * @returns {ArtifactDownloader}
 */
export function createNullArtifactDownloader() {
    return {
        async downloadArtifact(_artifact, _repoUrl) {
            return Buffer.alloc(0);
        },
    };
}
