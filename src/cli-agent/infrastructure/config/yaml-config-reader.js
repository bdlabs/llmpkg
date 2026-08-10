/**
 * @module infrastructure/config/yaml-config-reader
 * @description ConfigReader implementation — reads llmpkg config from JSON files.
 * Infrastructure layer — knows filesystem paths, home directory.
 *
 * Config precedence (enforced by ConfigResolver in ApplicationLogic):
 *   CLI arg → project config → user global config → defaults
 *
 * Formats: JSON (simplified from YAML for MVP — no external deps).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createDefaultConfig } from '../../domain/contracts/config-reader.js';

/**
 * Read and parse a JSON config file. Returns null if not found.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readJsonConfig(filePath) {
    try {
        const text = await readFile(filePath, 'utf8');
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function writeJsonConfig(filePath, config) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Create a config reader backed by filesystem JSON files.
 * @param {{ cwd?: string }} [options]
 * @returns {import('../../domain/contracts/config-reader.js').ConfigReader}
 */
export function createYamlConfigReader({ cwd = process.cwd() } = {}) {
    const globalPath = join(homedir(), '.config', 'llmpkg', 'config.json');
    const projectPath = join(cwd, 'llmpkg.json');

    return {
        async readGlobalConfig() {
            const raw = await readJsonConfig(globalPath);
            return { ...createDefaultConfig(), ...(raw ?? {}) };
        },

        async readProjectConfig() {
            return readJsonConfig(projectPath);
        },

        async writeGlobalConfig(config) {
            await writeJsonConfig(globalPath, config);
        },

        async writeProjectConfig(config) {
            await writeJsonConfig(projectPath, config);
        },
    };
}
