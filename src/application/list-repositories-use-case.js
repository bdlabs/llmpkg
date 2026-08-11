/**
 * @module application/list-repositories-use-case
 * @description ListRepositoriesUseCase — lists configured repositories.
 * ApplicationLogic layer.
 */

/**
 * Execute list repositories.
 * @param {object} command
 * @param {{ config: import('../domain/contracts/config-reader.js').LlmpkgConfig }} deps
 * @returns {Promise<Array<{ name: string, url: string }>>}
 */
export async function execute(command, { config }) {
    return config.repositories ?? [];
}
