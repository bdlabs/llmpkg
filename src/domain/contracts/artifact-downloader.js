/**
 * @module contracts/artifact-downloader
 * @description Contract: ArtifactDownloader — downloads artifact file content.
 * Defined in domain, implemented in infrastructure.
 *
 * @typedef {{
 *   downloadArtifact: (artifact: import('../artifact.js').Artifact, repoUrl: string) => Promise<Buffer>,
 * }} ArtifactDownloader
 */


