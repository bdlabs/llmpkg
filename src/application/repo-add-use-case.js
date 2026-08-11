/**
 * @module application/repo-add-use-case
 * @description Repositories addition use case.
 * ApplicationLogic layer — orchestrates config check and persistence.
 */

import { createDefaultConfig } from '../domain/contracts/config-reader.js';
import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';

const LOCAL_CREDENTIAL_WARNING = 'Project-scoped repository credentials may be shared with the project, while encrypted passwords can only be decrypted by the current user. Prefer --global for private credentials.';

function normalizeRepositoryInput(value) {
    if (!value.includes('://')) {
        const scp = /^(?:([^/@\s:]+)@)?([^/:\s]+):(.+)$/.exec(value);
        if (!scp) return { url: value };
        return { url: `${scp[2]}:${scp[3]}`, username: scp[1] };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return { url: value };
    }

    try {
        const embedded = {
            username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        };
        parsed.username = '';
        parsed.password = '';
        return { url: parsed.toString(), ...embedded };
    } catch {
        throw new LlmpkgError(ERROR_CODES.AUTHENTICATION_REQUIRED, 'The repository URL contains malformed credentials.');
    }
}

function endpoint(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.hostname}:${url.port}`;
    } catch {
        const scp = /^(?:[^/@\s:]+@)?([^/:\s]+):/.exec(value);
        return scp ? `ssh://${scp[1]}` : value;
    }
}

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
        const sameEndpoint = endpoint(current.url) === endpoint(url);
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
