/**
 * @module infrastructure/store/json-package-store
 * @description JSON file-backed PackageStore implementation.
 * Infrastructure layer — persists install records to a JSON file on disk.
 *
 * File format: { "packages": { "<name>": { InstallRecord } } }
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

/**
 * Create a JSON-backed PackageStore.
 * @param {string} storePath - Path to the JSON store file (e.g., .llmpkg/installed.json)
 * @returns {import('../../domain/contracts/package-store.js').PackageStore}
 */
export function createJsonPackageStore(storePath) {
    async function readStore() {
        try {
            const text = await readFile(storePath, 'utf8');
            const parsed = JSON.parse(text);
            return parsed.packages ?? {};
        } catch (err) {
            if (err.code === 'ENOENT') return {};
            throw new LlmpkgError(ERROR_CODES.INVALID_MANIFEST, `Cannot read store at ${storePath}: ${err.message}`);
        }
    }

    async function writeStore(packages) {
        await mkdir(dirname(storePath), { recursive: true });
        await writeFile(storePath, JSON.stringify({ packages }, null, 2), 'utf8');
    }

    return {
        async saveInstallRecord(record) {
            const packages = await readStore();
            packages[record.name] = record;
            await writeStore(packages);
        },

        async getInstallRecord(name) {
            const packages = await readStore();
            return packages[name] ?? null;
        },

        async listInstalled() {
            const packages = await readStore();
            return Object.values(packages);
        },

        async removeInstallRecord(name) {
            const packages = await readStore();
            delete packages[name];
            await writeStore(packages);
        },
    };
}
