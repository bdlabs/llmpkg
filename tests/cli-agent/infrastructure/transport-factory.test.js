import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArtifactDownloader, createManifestFetcher } from '../../../src/infrastructure/transport/transport-factory.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('transport factory facade regressions', () => {
    test('delegates local manifest and artifact operations', async () => {
        const root = await mkdtemp(join(tmpdir(), 'llmpkg-factory-'));
        try {
            await mkdir(join(root, 'packages', 'demo', '1.0.0'), { recursive: true });
            await mkdir(join(root, 'packages', 'assets'), { recursive: true });
            await writeFile(join(root, 'packages', 'demo', '1.0.0', 'manifest.json'), '{"name":"demo"}');
            await writeFile(join(root, 'packages', 'assets', 'demo.txt'), 'local');
            assert.deepEqual(await createManifestFetcher([]).fetchManifest('demo', '1.0.0', root), { name: 'demo' });
            assert.equal((await createArtifactDownloader([]).downloadArtifact({ path: 'assets/demo.txt' }, root)).toString(), 'local');
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    test('delegates HTTP and GitHub manifest operations', async () => {
        const requested = [];
        globalThis.fetch = async (url) => {
            requested.push(String(url));
            return new Response('{"name":"demo"}', { status: 200, headers: { 'content-type': 'application/json' } });
        };
        await createManifestFetcher([]).fetchManifest('demo', '1.0.0', 'https://registry.example.test');
        await createManifestFetcher([]).fetchManifest('demo', '1.0.0', 'github:owner/repo');
        assert.equal(requested[0], 'https://registry.example.test/packages/demo/1.0.0/manifest.json');
        assert.equal(requested[1], 'https://raw.githubusercontent.com/owner/repo/main/packages/demo/1.0.0/manifest.json');
    });
});
