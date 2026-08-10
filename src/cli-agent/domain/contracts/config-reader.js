/**
 * @module contracts/config-reader
 * @description Contract: ConfigReader — reads llmpkg configuration.
 * Defined in domain, implemented in infrastructure.
 *
 * @typedef {{
 *   repositories: Array<{ name: string, url: string, priority: number }>,
 *   defaultTarget?: string,
 * }} LlmpkgConfig
 *
 * @typedef {{
 *   readGlobalConfig: () => Promise<LlmpkgConfig>,
 *   readProjectConfig: () => Promise<LlmpkgConfig|null>,
 *   writeGlobalConfig: (config: LlmpkgConfig) => Promise<void>,
 *   writeProjectConfig: (config: LlmpkgConfig) => Promise<void>,
 * }} ConfigReader
 */

/** @returns {LlmpkgConfig} */
export function createDefaultConfig() {
    return { repositories: [], defaultTarget: null };
}

