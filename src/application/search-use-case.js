/**
 * @module application/search-use-case
 * @description SearchUseCase — searches for packages across repositories.
 * ApplicationLogic layer — orchestrates domain + contracts, no argv, no HTTP.
 *
 * Use case question: could this same logic be called from a REST API? Yes → belongs here.
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';

/**
 * @typedef {{ query: string, repository?: string }} SearchCommand
 * @typedef {{ packages: import('../domain/contracts/repository-index.js').PackageEntry[], totalCount: number }} SearchResult
 */

/**
 * Execute a package search.
 * @param {SearchCommand} command
 * @param {{ repositoryIndex: import('../domain/contracts/repository-index.js').RepositoryIndex }} deps
 * @returns {Promise<SearchResult>}
 */
export async function execute(command, { repositoryIndex }) {
    if (!command.query || typeof command.query !== 'string') {
        throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Search query must be a non-empty string.');
    }

    const packages = await repositoryIndex.searchPackages(command.query.trim());

    return {
        packages,
        totalCount: packages.length,
    };
}
