/**
 * @module application/install-use-case
 * @description InstallUseCase — orchestrates the full install pipeline.
 * ApplicationLogic layer — no argv, no HTTP, no direct file I/O.
 *
 * All side effects go through injected contracts.
 * Dry-run is handled by injecting NoOpFileSystem — use case logic doesn't change.
 *
 * Pipeline:
 *   resolve → fetch manifest → verify integrity → check conflicts → install → lock
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';
import { execute as resolveExecute } from './resolve-use-case.js';
import { createInstallPlan } from '../domain/install-plan.js';
import { assertIntegrity } from '../domain/integrity.js';

/**
 * @typedef {{
 *   packageName: string,
 *   version?: string,
 *   targetDir: string,
 *   dryRun?: boolean,
 *   repository?: string,
 * }} InstallCommand
 *
 * @typedef {{
 *   installed: string[],
 *   lockfileEntry: object,
 *   dryRun: boolean,
 * }} InstallResult
 */

/**
 * Execute a package installation.
 * @param {InstallCommand} command
 * @param {{
 *   repositoryIndex: import('../domain/contracts/repository-index.js').RepositoryIndex,
 *   manifestFetcher: import('../domain/contracts/manifest-fetcher.js').ManifestFetcher,
 *   artifactDownloader: import('../domain/contracts/artifact-downloader.js').ArtifactDownloader,
 *   packageStore: import('../domain/contracts/package-store.js').PackageStore,
 *   fileSystem: import('../domain/contracts/file-system.js').FileSystemWriter,
 *   configReader: import('../domain/contracts/config-reader.js').ConfigReader,
 * }} deps
 * @returns {Promise<InstallResult>}
 */
export async function execute(command, { repositoryIndex, manifestFetcher, artifactDownloader, packageStore, fileSystem, configReader }) {
    const { packageName, targetDir, dryRun = false, repository } = command;

    if (!packageName) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'packageName is required.');
    if (!targetDir) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'targetDir is required.');

    // Step 1: Resolve
    const resolved = await resolveExecute(
        { packageName, versionConstraint: command.version, repository },
        { repositoryIndex, manifestFetcher },
    );

    const pkg = resolved.package;

    // Step 2: Create and validate install plan (domain rule: path traversal check)
    const plan = createInstallPlan({ artifacts: pkg.artifacts, targetDir });
    plan.validate();

    const installPaths = plan.getInstallPaths();
    const installedFiles = [];

    // Step 3: Check conflicts
    for (const [artifactId, targetPath] of installPaths.entries()) {
        const exists = await fileSystem.fileExists(targetPath);
        if (exists) {
            throw new LlmpkgError(
                ERROR_CODES.FILE_CONFLICT,
                `File conflict: "${targetPath}" already exists.`,
                { artifactId, targetPath },
            );
        }
    }

    const config = await configReader.readGlobalConfig();
    const repoUrl = config.repositories.find((r) => r.name === repository)?.url ?? repository ?? '';

    // Step 4: Download + verify + write each artifact
    for (const artifact of pkg.artifacts) {
        const data = await artifactDownloader.downloadArtifact(artifact, repoUrl);

        // Integrity check — domain rule — only if hash is provided in manifest
        if (artifact.integrity) {
            assertIntegrity(data, artifact.integrity, artifact.id);
        }

        const destPath = installPaths.get(artifact.id);
        await fileSystem.ensureDir(destPath.replace(/[/\\][^/\\]+$/, ''));
        await fileSystem.writeFile(destPath, data);
        installedFiles.push(destPath);
    }

    // Step 5: Persist lock record
    const lockfileEntry = {
        name: pkg.name,
        version: pkg.version,
        repository: resolved.repository,
        installedAt: new Date().toISOString(),
        files: installedFiles,
    };
    await packageStore.saveInstallRecord(lockfileEntry);

    return { installed: installedFiles, lockfileEntry, dryRun };
}
