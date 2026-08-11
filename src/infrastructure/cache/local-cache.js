/**
 * @module infrastructure/cache/local-cache
 * @description Local file-backed cache for indexes and manifests.
 * Infrastructure layer — reduces network requests, enables partial offline mode.
 */

import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Create a local filesystem cache.
 * @param {string} cacheDir - Directory to store cached JSON entries
 * @returns {{ get: Function, set: Function, isValid: Function, clear: Function }}
 */
export function createLocalCache(cacheDir) {
    function entryPath(key) {
        const safe = key.replace(/[^a-z0-9_-]/gi, '_');
        return join(cacheDir, `${safe}.json`);
    }

    return {
        async get(key) {
            try {
                const text = await readFile(entryPath(key), 'utf8');
                const entry = JSON.parse(text);
                return entry.value;
            } catch {
                return undefined;
            }
        },

        async set(key, value, ttlMs = 3_600_000) {
            const entry = { value, expiresAt: Date.now() + ttlMs };
            const path = entryPath(key);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, JSON.stringify(entry), 'utf8');
        },

        async isValid(key) {
            try {
                const text = await readFile(entryPath(key), 'utf8');
                const entry = JSON.parse(text);
                return Date.now() < entry.expiresAt;
            } catch {
                return false;
            }
        },

        async clear(key) {
            try {
                await unlink(entryPath(key));
            } catch {
                // Ignore — already missing
            }
        },
    };
}
