import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createYamlConfigReader } from '../../../src/infrastructure/config/yaml-config-reader.js';

const temporaryRoots = [];

afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'llmpkg-config-test-'));
    temporaryRoots.push(root);
    const cwd = join(root, 'project');
    const userConfigDir = join(root, 'user-config', 'llmpkg');
    await mkdir(cwd, { recursive: true });
    return { root, cwd, userConfigDir, reader: createYamlConfigReader({ cwd, userConfigDir }) };
}

describe('repository credential persistence', () => {
    test('encrypts passwords with a per-user AES-GCM key outside the project', async () => {
        const { cwd, userConfigDir, reader } = await fixture();
        const secret = 'correct horse battery staple';
        await reader.writeProjectConfig({ repositories: [{ name: 'private', url: 'https://example.test/repo.git', priority: 0, password: secret }] });

        const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
        const keyPath = join(userConfigDir, 'credentials.key');
        const [storedConfig, storedKey] = await Promise.all([readFile(configPath, 'utf8'), readFile(keyPath, 'utf8')]);
        assert.equal(storedConfig.includes(secret), false);
        assert.equal(storedKey.includes(secret), false);
        assert.match(storedConfig, /llmpkg-password-v1:/);
        assert.equal((await reader.readProjectConfig()).repositories[0].password, secret);

        if (process.platform !== 'win32') {
            assert.equal((await stat(configPath)).mode & 0o777, 0o600);
            assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
            assert.equal((await stat(userConfigDir)).mode & 0o777, 0o700);
        }
    });

    test('reads legacy plaintext and encrypts it on the next write', async () => {
        const { cwd, userConfigDir, reader } = await fixture();
        const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
        await mkdir(join(cwd, '.llmpkg'), { recursive: true });
        await writeFile(configPath, JSON.stringify({ repositories: [{ name: 'legacy', url: 'https://example.test', password: 'legacy-secret' }] }));

        const config = await reader.readProjectConfig();
        assert.equal(config.repositories[0].password, 'legacy-secret');
        await reader.writeProjectConfig(config);
        const stored = await readFile(configPath, 'utf8');
        assert.equal(stored.includes('legacy-secret'), false);
        await assert.doesNotReject(() => readFile(join(userConfigDir, 'credentials.key')));
    });

    test('rejects tampered authenticated ciphertext', async () => {
        const { cwd, reader } = await fixture();
        await reader.writeProjectConfig({ repositories: [{ name: 'private', url: 'https://example.test', password: 'secret' }] });
        const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
        const stored = JSON.parse(await readFile(configPath, 'utf8'));
        stored.repositories[0].passwordEncrypted = stored.repositories[0].passwordEncrypted.replace(/.$/, (char) => char === 'A' ? 'B' : 'A');
        await writeFile(configPath, JSON.stringify(stored));
        await assert.rejects(() => reader.readProjectConfig());
    });
});
