import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../../../src/cli-agent/application/search-use-case.js';
import { createNullRepositoryIndex } from '../../../src/cli-agent/infrastructure/tests/test-helpers.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/cli-agent/domain/errors.js';

describe('SearchUseCase', () => {
    test('returns empty results from null index', async () => {
        const result = await execute({ query: 'postgres' }, { repositoryIndex: createNullRepositoryIndex() });
        assert.deepEqual(result.packages, []);
        assert.equal(result.totalCount, 0);
    });

    test('returns results from mock index', async () => {
        const mockIndex = {
            async searchPackages(query) {
                return [{ name: 'postgres-expert', version: '1.4.0', repository: 'community', description: 'PostgreSQL tools' }];
            },
            async getPackageVersions() { return []; },
        };
        const result = await execute({ query: 'postgres' }, { repositoryIndex: mockIndex });
        assert.equal(result.packages.length, 1);
        assert.equal(result.packages[0].name, 'postgres-expert');
        assert.equal(result.totalCount, 1);
    });

    test('throws when query is empty', async () => {
        await assert.rejects(
            () => execute({ query: '' }, { repositoryIndex: createNullRepositoryIndex() }),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_PACKAGE,
        );
    });

    test('throws when query is missing', async () => {
        await assert.rejects(
            () => execute({}, { repositoryIndex: createNullRepositoryIndex() }),
            LlmpkgError,
        );
    });
});
