/**
 * @module application/resolve-use-case
 * @description ResolveUseCase — resolves a package + its dependencies into a concrete install plan.
 * ApplicationLogic layer (internal — called by InstallUseCase, not CLI directly).
 *
 * Separation: "what to choose" = domain logic. "how to get it" = contracts.
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';
import { parseManifest } from '../domain/manifest.js';
import { resolveBestVersion } from '../domain/version.js';
import { buildDependencyGraph, detectCycles, resolveDependencyOrder } from '../domain/dependency-graph.js';

/**
/**
 * @typedef {{ packageName: string, versionConstraint?: string, repository?: string, repoUrl?: string }} ResolveCommand
 * @typedef {{ package: import('../domain/package.js').Package, dependencies: import('../domain/package.js').Package[], repository: string, resolvedVersion: string }} ResolvedPlan
 */

/**
 * Recursively resolve a package and its transitive dependencies.
 * @param {ResolveCommand} command
 * @param {{ repositoryIndex: import('../domain/contracts/repository-index.js').RepositoryIndex, manifestFetcher: import('../domain/contracts/manifest-fetcher.js').ManifestFetcher }} deps
 * @returns {Promise<ResolvedPlan>}
 */
export async function execute(command, { repositoryIndex, manifestFetcher }) {
    const { packageName, versionConstraint, repository, repoUrl = '' } = command;

    const versions = await repositoryIndex.getPackageVersions(packageName);
    if (!versions || versions.length === 0) {
        throw new LlmpkgError(
            ERROR_CODES.PACKAGE_NOT_FOUND,
            `Package "${packageName}" not found.`,
        );
    }

    const constraint = versionConstraint ?? versions.slice().sort().at(-1);
    const resolved = resolveBestVersion(versions, constraint);
    if (!resolved) {
        throw new LlmpkgError(
            ERROR_CODES.VERSION_NOT_FOUND,
            `No version satisfying "${constraint}" found for "${packageName}".`,
        );
    }

    const raw = await manifestFetcher.fetchManifest(packageName, resolved, repoUrl);
    if (!raw) {
        throw new LlmpkgError(ERROR_CODES.INVALID_MANIFEST, `Manifest not found for "${packageName}@${resolved}".`);
    }

    const pkg = parseManifest(raw, repository ?? 'unknown');

    // Resolve direct dependencies (shallow for MVP — deep resolution would recurse here)
    const depPackages = [];
    for (const [depName, depConstraint] of Object.entries(pkg.dependencies)) {
        const depVersions = await repositoryIndex.getPackageVersions(depName);
        const depResolved = resolveBestVersion(depVersions ?? [], depConstraint);
        if (!depResolved) {
            throw new LlmpkgError(
                ERROR_CODES.VERSION_NOT_FOUND,
                `Dependency "${depName}" with constraint "${depConstraint}" cannot be satisfied.`,
            );
        }
        const depRaw = await manifestFetcher.fetchManifest(depName, depResolved, repoUrl);
        if (depRaw) {
            depPackages.push(parseManifest(depRaw, repository ?? 'unknown'));
        }
    }

    // Validate: no cycles
    const allPackages = [pkg, ...depPackages];
    const graph = buildDependencyGraph(allPackages);
    if (detectCycles(graph)) {
        throw new LlmpkgError(ERROR_CODES.DEPENDENCY_CYCLE, 'Circular dependency detected.');
    }

    return {
        package: pkg,
        dependencies: depPackages,
        repository: repository ?? 'unknown',
        resolvedVersion: resolved,
    };
}
