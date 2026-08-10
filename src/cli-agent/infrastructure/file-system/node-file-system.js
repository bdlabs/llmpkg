/**
 * @module infrastructure/file-system/node-file-system
 * @description Node.js filesystem implementation of FileSystemWriter contract.
 * Infrastructure layer — wraps Node.js fs/promises.
 */

import { readFile, writeFile, unlink, access, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { constants } from 'node:fs';
import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

/**
 * Create a real Node.js filesystem writer.
 * @returns {import('../../domain/contracts/file-system.js').FileSystemWriter}
 */
export function createNodeFileSystem() {
    return {
        async writeFile(path, data) {
            try {
                await mkdir(dirname(path), { recursive: true });
                await writeFile(path, data);
            } catch (err) {
                throw new LlmpkgError(ERROR_CODES.FILE_CONFLICT, `Cannot write file "${path}": ${err.message}`);
            }
        },

        async readFile(path) {
            try {
                return await readFile(path);
            } catch (err) {
                throw new LlmpkgError(ERROR_CODES.PACKAGE_NOT_FOUND, `Cannot read file "${path}": ${err.message}`);
            }
        },

        async fileExists(path) {
            try {
                await access(path, constants.F_OK);
                return true;
            } catch {
                return false;
            }
        },

        async deleteFile(path) {
            try {
                await unlink(path);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw new LlmpkgError(ERROR_CODES.FILE_CONFLICT, `Cannot delete file "${path}": ${err.message}`);
                }
            }
        },

        async ensureDir(path) {
            await mkdir(path, { recursive: true });
        },
    };
}
