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
import { normalizeRepositoryInput, repositoryEndpoint } from '../../application/repository-credentials.js';

const KEY_PREFIX = 'llmpkg-key-v1:';
const LEGACY_PASSWORD_PREFIX = 'llmpkg-password-v1:';
const PASSWORD_PREFIX = 'llmpkg-password-v2:';
const LEGACY_PASSWORD_AAD = Buffer.from('llmpkg:repository-password:v1');

export async function enforcePrivatePermissions(path, mode, { platform = process.platform, chmodImpl = chmod } = {}) {
    try {
        await chmodImpl(path, mode);
    } catch (error) {
        const unsupportedOnWindows = platform === 'win32' && ['ENOSYS', 'EINVAL'].includes(error?.code);
        if (!unsupportedOnWindows) throw error;
    }
}

async function ensurePrivateDirectory(directory) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await enforcePrivatePermissions(directory, 0o700);
}

async function loadKey(keyPath) {
    await enforcePrivatePermissions(dirname(keyPath), 0o700);
    const stored = (await readFile(keyPath, 'utf8')).trim();
    if (!stored.startsWith(KEY_PREFIX)) throw new Error('The llmpkg credential key has an unsupported format.');
    const key = Buffer.from(stored.slice(KEY_PREFIX.length), 'base64');
    if (key.length !== 32) throw new Error('The llmpkg credential key is invalid.');
    await enforcePrivatePermissions(keyPath, 0o600);
    return key;
}

async function loadOrCreateKey(keyPath) {
    try {
        return await loadKey(keyPath);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }

    await ensurePrivateDirectory(dirname(keyPath));
    const key = randomBytes(32);
    try {
        await writeFile(keyPath, `${KEY_PREFIX}${key.toString('base64')}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        await enforcePrivatePermissions(keyPath, 0o600);
        return key;
    } catch (error) {
        if (error?.code === 'EEXIST') return loadOrCreateKey(keyPath);
        throw error;
    }
}

function passwordAad(url) {
    return Buffer.from(`llmpkg:repository-password:v2:${repositoryEndpoint(url)}`);
}

function encryptPassword(password, key, url) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(passwordAad(url));
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PASSWORD_PREFIX}${nonce.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptPassword(value, key, url) {
    const prefix = value?.startsWith(PASSWORD_PREFIX)
        ? PASSWORD_PREFIX
        : value?.startsWith(LEGACY_PASSWORD_PREFIX) ? LEGACY_PASSWORD_PREFIX : undefined;
    if (!prefix) {
        throw new Error('The encrypted repository password has an unsupported format.');
    }
    const [nonceValue, tagValue, ciphertextValue] = value.slice(prefix.length).split(':');
    const nonce = Buffer.from(nonceValue ?? '', 'base64');
    const tag = Buffer.from(tagValue ?? '', 'base64');
    if (nonce.length !== 12 || tag.length !== 16 || ciphertextValue === undefined) {
        throw new Error('The encrypted repository password is invalid.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(prefix === LEGACY_PASSWORD_PREFIX ? LEGACY_PASSWORD_AAD : passwordAad(url));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64')), decipher.final()]).toString('utf8');
}

async function materializePasswords(config, keyPath) {
    if (!config) return config;
    const encrypted = (config.repositories ?? []).some((repo) => repo.passwordEncrypted !== undefined);
    const key = encrypted ? await loadKey(keyPath) : undefined;
    return {
        ...config,
        repositories: (config.repositories ?? []).map((repo) => {
            const normalized = normalizeRepositoryInput(repo.url);
            const { passwordEncrypted, password: legacyPassword, username: configuredUsername, ...safe } = repo;
            const decrypted = passwordEncrypted === undefined
                ? undefined
                : decryptPassword(passwordEncrypted, key, normalized.url);
            const username = configuredUsername ?? normalized.username;
            const password = legacyPassword ?? decrypted ?? normalized.password;
            return {
                ...safe,
                url: normalized.url,
                ...(username !== undefined ? { username } : {}),
                ...(password !== undefined ? { password } : {}),
            };
        }),
    };
}

async function protectPasswords(config, keyPath) {
    const repositories = (config?.repositories ?? []).map((repo) => {
        const normalized = normalizeRepositoryInput(repo.url);
        const { passwordEncrypted, password: configuredPassword, username: configuredUsername, ...safe } = repo;
        return {
            ...safe,
            url: normalized.url,
            username: configuredUsername ?? normalized.username,
            password: configuredPassword ?? normalized.password,
        };
    });
    const key = repositories.some((repo) => repo.password !== undefined)
        ? await loadOrCreateKey(keyPath)
        : undefined;
    return {
        ...config,
        repositories: repositories.map((repo) => {
            const { password, username, ...safe } = repo;
            return {
                ...safe,
                ...(username !== undefined ? { username } : {}),
                ...(password !== undefined ? { passwordEncrypted: encryptPassword(password, key, repo.url) } : {}),
            };
        }),
    };
}

/**
 * Read and parse a JSON config file. Returns null if not found.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readJsonConfig(filePath) {
    let text;
    try {
        text = await readFile(filePath, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
    await enforcePrivatePermissions(dirname(filePath), 0o700);
    await enforcePrivatePermissions(filePath, 0o600);
    try { return JSON.parse(text); } catch { return null; }
}

async function writeJsonConfig(filePath, config) {
    await ensurePrivateDirectory(dirname(filePath));
    try {
        await enforcePrivatePermissions(filePath, 0o600);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
    await writeFile(filePath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
    await enforcePrivatePermissions(filePath, 0o600);
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
