import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../../../src/application/repo-add-use-case.js';
import { formatRepoAddResultJson, formatRepositoryListJson } from '../../../src/cli/adapters/output/json-formatter.js';
import { formatRepoAddResult, formatRepositoryList, formatRepoWarnings } from '../../../src/cli/adapters/output/text-formatter.js';

function reader(initial = null) {
    let written;
    return {
        async readProjectConfig() { return initial; },
        async readGlobalConfig() { return initial ?? { repositories: [] }; },
        async writeProjectConfig(value) { written = value; },
        async writeGlobalConfig(value) { written = value; },
        get written() { return written; },
    };
}

describe('repository credentials', () => {
    test('persists optional credentials while returning only a safe result', async () => {
        const configReader = reader();
        const result = await execute({
            name: 'private',
            url: 'ssh://git@example.test:2222/repos/private.git',
            username: 'alice',
            password: 'secret',
        }, { configReader });
        assert.equal(configReader.written.repositories[0].username, 'alice');
        assert.equal(configReader.written.repositories[0].password, 'secret');
        assert.equal(result.authenticated, true);
        assert.equal(JSON.stringify(result).includes('secret'), false);
        assert.match(result.warnings[0], /Project-scoped/);
    });

    test('extracts URL credentials, persists a clean URL, and gives explicit flags precedence', async () => {
        const configReader = reader();
        const result = await execute({
            name: 'private',
            url: 'https://embedded:embedded-secret@example.test/repo.git',
            username: 'flag-user',
            password: 'flag-secret',
        }, { configReader });
        assert.equal(configReader.written.repositories[0].url, 'https://example.test/repo.git');
        assert.equal(configReader.written.repositories[0].username, 'flag-user');
        assert.equal(configReader.written.repositories[0].password, 'flag-secret');
        assert.equal(result.url, 'https://example.test/repo.git');
    });

    test('extracts SCP-like usernames before persistence', async () => {
        const configReader = reader();
        await execute({ name: 'private', url: 'git@example.test:team/repo.git' }, { configReader });
        assert.equal(configReader.written.repositories[0].url, 'example.test:team/repo.git');
        assert.equal(configReader.written.repositories[0].username, 'git');
    });

    test('never exposes passwords through repository formatters', () => {
        const repository = { name: 'private', url: 'https://alice:secret@example.test/repo.git', username: 'alice', password: 'secret' };
        for (const output of [
            formatRepositoryListJson([repository]),
            formatRepositoryList([repository]),
            formatRepoAddResultJson({ ...repository, global: false }),
            formatRepoAddResult({ ...repository, global: false }),
        ]) {
            assert.equal(output.includes('secret'), false);
            assert.equal(output.includes('alice:secret'), false);
        }
    });

    test('keeps JSON valid and emits safe warning text without credentials', () => {
        const repository = {
            name: 'private',
            url: 'https://example.test/repo.git',
            global: false,
            authenticated: true,
            warnings: ['Project-scoped repository credentials may be shared with the project.'],
        };
        const json = formatRepoAddResultJson(repository);
        assert.deepEqual(JSON.parse(json).warnings, repository.warnings);
        const warning = formatRepoWarnings(repository);
        assert.equal(warning.includes('Warning:'), true);
        assert.equal(warning.includes('secret'), false);
        assert.equal(formatRepoAddResult(repository).includes('Warning:'), false);
    });

    test('drops an old password when the endpoint changes but adopts new URL userinfo', async () => {
        const configReader = reader({ repositories: [{ name: 'private', url: 'ssh://git@old.test/repo.git', username: 'git', password: 'old-secret' }] });
        const result = await execute({ name: 'private', url: 'ssh://git@new.test/repo.git' }, { configReader });
        assert.equal(configReader.written.repositories[0].username, 'git');
        assert.equal(configReader.written.repositories[0].password, undefined);
        assert.equal(result.authenticated, true);
    });

    test('keeps credentials when only the path changes on the same endpoint', async () => {
        const configReader = reader({ repositories: [{ name: 'private', url: 'ssh://git@example.test/old.git', username: 'git', password: 'secret' }] });
        const result = await execute({ name: 'private', url: 'ssh://git@example.test/new.git' }, { configReader });
        assert.equal(configReader.written.repositories[0].password, 'secret');
        assert.equal(result.authenticated, true);
    });
});
