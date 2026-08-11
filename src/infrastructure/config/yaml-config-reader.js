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

import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createDefaultConfig } from '../../domain/contracts/config-reader.js';

const KEY_PREFIX = 'llmpkg-key-v1:';
const PASSWORD_PREFIX = 'llmpkg-password-v1:';
const PASSWORD_AAD = Buffer.from('llmpkg:repository-password:v1');

async function restrictPermissions(path, mode) {
    try {
        await chmod(path, mode);
    } catch (error) {
        if (!['EPERM', 'ENOSYS', 'EINVAL'].includes(error?.code)) throw error;
    }
}

async function ensurePrivateDirectory(directory) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await restrictPermissions(directory, 0o700);
}

async function loadOrCreateKey(keyPath) {
    try {
        const stored = (await readFile(keyPath, 'utf8')).trim();
        if (!stored.startsWith(KEY_PREFIX)) throw new Error('The llmpkg credential key has an unsupported format.');
        const key = Buffer.from(stored.slice(KEY_PREFIX.length), 'base64');
        if (key.length !== 32) throw new Error('The llmpkg credential key is invalid.');
        await restrictPermissions(keyPath, 0o600);
        return key;
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }

    const key = randomBytes(32);
    try {
        await writeFile(keyPath, `${KEY_PREFIX}${key.toString('base64')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        await restrictPermissions(keyPath, 0o600);
        return key;
    } catch (error) {
        if (error?.code === 'EEXIST') return loadOrCreateKey(keyPath);
        throw error;
    }
}

function encryptPassword(password, key) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(PASSWORD_AAD);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PASSWORD_PREFIX}${nonce.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptPassword(value, key) {
    if (typeof value !== 'string' || !value.startsWith(PASSWORD_PREFIX)) {
        throw new Error('The encrypted repository password has an unsupported format.');
    }
    const [nonceValue, tagValue, ciphertextValue] = value.slice(PASSWORD_PREFIX.length).split(':');
    const nonce = Buffer.from(nonceValue ?? '', 'base64');
    const tag = Buffer.from(tagValue ?? '', 'base64');
    if (nonce.length !== 12 || tag.length !== 16 || ciphertextValue === undefined) {
        throw new Error('The encrypted repository password is invalid.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(PASSWORD_AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64')), decipher.final()]).toString('utf8');
}

async function materializePasswords(config, keyPath) {
    const encrypted = (config?.repositories ?? []).filter((repo) => repo.passwordEncrypted !== undefined);
    if (encrypted.length === 0) return config;
    const key = await loadOrCreateKey(keyPath);
    return {
        ...config,
        repositories: (config.repositories ?? []).map((repo) => repo.passwordEncrypted === undefined ? repo : {
            ...repo,
            password: decryptPassword(repo.passwordEncrypted, key),
        }),
    };
}

async function protectPasswords(config, keyPath) {
    const passwords = (config?.repositories ?? []).filter((repo) => repo.password !== undefined);
    if (passwords.length === 0) return config;
    const key = await loadOrCreateKey(keyPath);
    return {
        ...config,
        repositories: (config.repositories ?? []).map((repo) => {
            if (repo.password === undefined) return repo;
            const { password, ...safe } = repo;
            return { ...safe, passwordEncrypted: encryptPassword(password, key) };
        }),
    };
}

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
    await ensurePrivateDirectory(dirname(filePath));
    await writeFile(filePath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
    await restrictPermissions(filePath, 0o600);
}

/**
 * Create a config reader backed by filesystem JSON files.
 * @param {{ cwd?: string, userConfigDir?: string }} [options]
 * @returns {import('../../domain/contracts/config-reader.js').ConfigReader}
 */
export function createYamlConfigReader({ cwd = process.cwd(), userConfigDir = join(homedir(), '.config', 'llmpkg') } = {}) {
    const globalPath = join(userConfigDir, 'config.json');
    const projectPath = join(cwd, '.llmpkg', 'llmpkg.json');
    const keyPath = join(userConfigDir, 'credentials.key');

    return {
        async readGlobalConfig() {
            const raw = await materializePasswords(await readJsonConfig(globalPath), keyPath);
            return { ...createDefaultConfig(), ...(raw ?? {}) };
        },

        async readProjectConfig() {
            return materializePasswords(await readJsonConfig(projectPath), keyPath);
        },

        async writeGlobalConfig(config) {
            await ensurePrivateDirectory(userConfigDir);
            await writeJsonConfig(globalPath, await protectPasswords(config, keyPath));
        },

        async writeProjectConfig(config) {
            await ensurePrivateDirectory(userConfigDir);
            await writeJsonConfig(projectPath, await protectPasswords(config, keyPath));
        },
    };
}
