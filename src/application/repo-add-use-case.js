/**
 * @module application/repo-add-use-case
 * @description Repositories addition use case.
 * ApplicationLogic layer — orchestrates config check and persistence.
 */

import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';
import { createDefaultConfig } from '../domain/contracts/config-reader.js';

/**
 * Execute the repository add workflow.
 * @param {{ name: string, url: string, global?: boolean }} input
 * @param {{ configReader: import('../domain/contracts/config-reader.js').ConfigReader }} deps
 * @returns {Promise<{ name: string, url: string, global: boolean }>}
 */
export async function execute({ name, url, global = false }, { configReader }) {
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
    if (index !== -1) {
        config.repositories[index].url = url;
    } else {
        config.repositories.push({ name, url, priority: config.repositories.length });
    }

    if (global) {
        await configReader.writeGlobalConfig(config);
    } else {
        await configReader.writeProjectConfig(config);
    }

    return { name, url, global };
}
