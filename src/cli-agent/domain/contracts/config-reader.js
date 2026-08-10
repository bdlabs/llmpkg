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
 * }} ConfigReader
 */

/** @returns {LlmpkgConfig} */
export function createDefaultConfig() {
    return { repositories: [], defaultTarget: null };
}

/**
 * Null-object implementation for tests.
 * @returns {ConfigReader}
 */
export function createNullConfigReader(overrides = {}) {
    return {
        async readGlobalConfig() { return { ...createDefaultConfig(), ...overrides }; },
        async readProjectConfig() { return null; },
    };
}
