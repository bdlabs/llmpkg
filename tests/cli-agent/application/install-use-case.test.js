import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../../../src/application/install-use-case.js';
import {
    createNullArtifactDownloader,
    createNullPackageStore,
    createNullRepositoryIndex,
    createNullManifestFetcher,
    createNullConfigReader,
} from '../../../src/infrastructure/tests/test-helpers.js';
import { createNoOpFileSystem } from '../../../src/infrastructure/file-system/noop-file-system.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/domain/errors.js';

const validManifest = {
    schema: 'llmpkg/v1',
    name: 'postgres-expert',
    version: '1.4.0',
    description: 'PostgreSQL tools',
    artifacts: [{ id: 'query-opt', type: 'skill', path: 'skills/query.md' }],
    dependencies: {},
};

function makeDeps(overrides = {}) {
    return {
        repositoryIndex: {
            async searchPackages() { return []; },
            async getPackageVersions() { return ['1.4.0']; },
        },
        manifestFetcher: {
            async fetchManifest() { return validManifest; },
        },
        artifactDownloader: createNullArtifactDownloader(),
        packageStore: createNullPackageStore(),
        fileSystem: createNoOpFileSystem(),
        configReader: createNullConfigReader(),
        config: { repositories: [] },
        ...overrides,
    };
}

describe('InstallUseCase', () => {
    test('happy path: installs package and returns lockfile entry', async () => {
        const result = await execute(
            { packageName: 'postgres-expert', targetDir: '/tmp/skills', dryRun: false },
            makeDeps(),
        );
        assert.ok(Array.isArray(result.installed));
        assert.equal(result.lockfileEntry.name, 'postgres-expert');
        assert.equal(result.lockfileEntry.version, '1.4.0');
    });

    test('dry-run returns installed list without writing files', async () => {
        const result = await execute(
            { packageName: 'postgres-expert', targetDir: '/tmp/skills', dryRun: true },
            makeDeps(),
        );
        assert.equal(result.dryRun, true);
    });

    test('throws PACKAGE_NOT_FOUND when no versions', async () => {
        await assert.rejects(
            () => execute(
                { packageName: 'nonexistent', targetDir: '/tmp/test' },
                makeDeps({ repositoryIndex: { async getPackageVersions() { return []; }, async searchPackages() { return []; } } }),
            ),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.PACKAGE_NOT_FOUND,
        );
    });

    test('throws INVALID_PACKAGE when packageName is missing', async () => {
        await assert.rejects(
            () => execute({ targetDir: '/tmp/test' }, makeDeps()),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_PACKAGE,
        );
    });

    test('throws FILE_CONFLICT when file already exists', async () => {
        const conflictFs = {
            async writeFile() { },
            async readFile() { return Buffer.alloc(0); },
            async fileExists() { return true; }, // Always exists
            async deleteFile() { },
            async ensureDir() { },
        };
        await assert.rejects(
            () => execute(
                { packageName: 'postgres-expert', targetDir: '/tmp/skills' },
                makeDeps({ fileSystem: conflictFs }),
            ),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.FILE_CONFLICT,
        );
    });
});
