/**
 * @module application/repo-add-use-case
 * @description Repositories addition use case.
 * ApplicationLogic layer — orchestrates config check and persistence.
 */

import { createDefaultConfig } from '../domain/contracts/config-reader.js';
import { normalizeRepositoryInput, repositoryEndpoint } from './repository-credentials.js';

const LOCAL_CREDENTIAL_WARNING = 'Project-scoped repository credentials may be shared with the project, while encrypted passwords can only be decrypted by the current user. Prefer --global for private credentials.';

/**
 * Execute the repository add workflow.
 * @param {{ name: string, url: string, global?: boolean, username?: string, password?: string }} input
 * @param {{ configReader: import('../domain/contracts/config-reader.js').ConfigReader }} deps
 * @returns {Promise<{ name: string, url: string, global: boolean }>}
 */
export async function execute({ name, url, global = false, username, password }, { configReader }) {
    const embedded = normalizeRepositoryInput(url);
    url = embedded.url;
    username ??= embedded.username;
    password ??= embedded.password;
    let config;
    if (global) {
        config = await configReader.readGlobalConfig();
    } else {
        config = await configReader.readProjectConfig();
        if (!config) {
            config = createDefaultConfig();
        }
    }

    if (!config.repositories) {
        config.repositories = [];
    }

    const index = config.repositories.findIndex((r) => r.name === name);
    let savedRepository;
    if (index !== -1) {
        const current = config.repositories[index];
        const sameEndpoint = repositoryEndpoint(current.url) === repositoryEndpoint(url);
        savedRepository = {
            ...current,
            url,
            ...(!sameEndpoint ? { username: undefined, password: undefined } : {}),
            ...(username !== undefined ? { username } : {}),
            ...(password !== undefined ? { password } : {}),
        };
        config.repositories[index] = savedRepository;
    } else {
        savedRepository = {
            name,
            url,
            priority: config.repositories.length,
            ...(username !== undefined ? { username } : {}),
            ...(password !== undefined ? { password } : {}),
        };
        config.repositories.push(savedRepository);
    }

    if (global) {
        await configReader.writeGlobalConfig(config);
    } else {
        await configReader.writeProjectConfig(config);
    }

    const authenticated = Boolean(savedRepository.username || savedRepository.password);
    return {
        name,
        url,
        global,
        authenticated,
        ...(!global && authenticated ? { warnings: [LOCAL_CREDENTIAL_WARNING] } : {}),
    };
}
