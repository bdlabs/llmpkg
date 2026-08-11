import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createJsonPackageStore } from '../../../src/infrastructure/store/json-package-store.js';

let tmpDir;
let storePath;
let store;

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'llmpkg-store-test-'));
    storePath = join(tmpDir, 'installed.json');
    store = createJsonPackageStore(storePath);
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

const record = {
    name: 'postgres-expert',
    version: '1.4.0',
    repository: 'community',
    installedAt: new Date().toISOString(),
    files: ['/skills/query.md'],
};

describe('JsonPackageStore', () => {
    test('listInstalled returns empty array when no records', async () => {
        const list = await store.listInstalled();
        assert.deepEqual(list, []);
    });

    test('saveInstallRecord then getInstallRecord', async () => {
        await store.saveInstallRecord(record);
        const found = await store.getInstallRecord('postgres-expert');
        assert.equal(found.name, 'postgres-expert');
        assert.equal(found.version, '1.4.0');
    });

    test('listInstalled returns saved records', async () => {
        const list = await store.listInstalled();
        assert.equal(list.length, 1);
    });

    test('removeInstallRecord removes the record', async () => {
        await store.removeInstallRecord('postgres-expert');
        const found = await store.getInstallRecord('postgres-expert');
        assert.equal(found, null);
    });

    test('getInstallRecord returns null for unknown package', async () => {
        const found = await store.getInstallRecord('nonexistent');
        assert.equal(found, null);
    });
});
