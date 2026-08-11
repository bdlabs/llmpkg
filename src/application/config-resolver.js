/**
 * @module application/config-resolver
 * @description ConfigResolver — merges global and project configurations.
 * ApplicationLogic layer.
 */

/**
 * Resolves the final configuration by merging global and project configs.
 * Project config takes precedence over global config.
 * @param {import('../domain/contracts/config-reader.js').ConfigReader} configReader
 * @returns {Promise<import('../domain/contracts/config-reader.js').LlmpkgConfig>}
 */
export async function resolveConfig(configReader) {
    const globalConfig = await configReader.readGlobalConfig();
    const projectConfig = await configReader.readProjectConfig();
    return { ...globalConfig, ...(projectConfig ?? {}) };
}
