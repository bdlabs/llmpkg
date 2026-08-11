import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../../../src/application/repo-add-use-case.js';
import { formatRepoAddResultJson, formatRepositoryListJson } from '../../../src/cli/adapters/output/json-formatter.js';
import { formatRepoAddResult, formatRepositoryList } from '../../../src/cli/adapters/output/text-formatter.js';

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

    test('drops old credentials when the repository endpoint changes', async () => {
        const configReader = reader({ repositories: [{ name: 'private', url: 'ssh://git@old.test/repo.git', username: 'git', password: 'old-secret' }] });
        const result = await execute({ name: 'private', url: 'ssh://git@new.test/repo.git' }, { configReader });
        assert.equal(configReader.written.repositories[0].username, undefined);
        assert.equal(configReader.written.repositories[0].password, undefined);
        assert.equal(result.authenticated, false);
    });

    test('keeps credentials when only the path changes on the same endpoint', async () => {
        const configReader = reader({ repositories: [{ name: 'private', url: 'ssh://git@example.test/old.git', username: 'git', password: 'secret' }] });
        const result = await execute({ name: 'private', url: 'ssh://git@example.test/new.git' }, { configReader });
        assert.equal(configReader.written.repositories[0].password, 'secret');
        assert.equal(result.authenticated, true);
    });
});
