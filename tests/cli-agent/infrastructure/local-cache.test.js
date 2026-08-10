import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalCache } from '../../../src/cli-agent/infrastructure/cache/local-cache.js';

let tmpDir;
let cache;

before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'llmpkg-cache-test-'));
    cache = createLocalCache(tmpDir);
});

after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('LocalCache', () => {
    test('get returns undefined for missing key', async () => {
        const val = await cache.get('missing-key');
        assert.equal(val, undefined);
    });

    test('set then get returns value', async () => {
        await cache.set('test-key', { data: 'hello' });
        const val = await cache.get('test-key');
        assert.deepEqual(val, { data: 'hello' });
    });

    test('isValid returns true for fresh entry', async () => {
        await cache.set('fresh', 'data', 60_000);
        const valid = await cache.isValid('fresh');
        assert.equal(valid, true);
    });

    test('isValid returns false for missing key', async () => {
        const valid = await cache.isValid('nonexistent-key-xyz');
        assert.equal(valid, false);
    });

    test('clear removes entry', async () => {
        await cache.set('to-clear', 'value');
        await cache.clear('to-clear');
        const val = await cache.get('to-clear');
        assert.equal(val, undefined);
    });

    test('clear on missing key does not throw', async () => {
        await assert.doesNotReject(() => cache.clear('never-set-key'));
    });
});
