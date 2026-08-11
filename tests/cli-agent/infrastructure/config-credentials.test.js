import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createYamlConfigReader, enforcePrivatePermissions } from '../../../src/infrastructure/config/yaml-config-reader.js';
import { execute as addRepository } from '../../../src/application/repo-add-use-case.js';

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
        assert.match(storedConfig, /llmpkg-password-v2:/);
        const runtimeRepository = (await reader.readProjectConfig()).repositories[0];
        assert.equal(runtimeRepository.password, secret);
        assert.equal(runtimeRepository.passwordEncrypted, undefined);

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

    test('reads v1 ciphertext and rewrites it in endpoint-bound v2 format', async () => {
        const { cwd, userConfigDir, reader } = await fixture();
        const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
        const keyPath = join(userConfigDir, 'credentials.key');
        await mkdir(join(cwd, '.llmpkg'), { recursive: true });
        await mkdir(userConfigDir, { recursive: true });
        const key = randomBytes(32);
        await writeFile(keyPath, `llmpkg-key-v1:${key.toString('base64')}\n`);
        const nonce = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, nonce);
        cipher.setAAD(Buffer.from('llmpkg:repository-password:v1'));
        const ciphertext = Buffer.concat([cipher.update('v1-secret', 'utf8'), cipher.final()]);
        const encrypted = `llmpkg-password-v1:${nonce.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
        await writeFile(configPath, JSON.stringify({ repositories: [{ name: 'private', url: 'https://example.test/repo.git', passwordEncrypted: encrypted }] }));

        const logical = await reader.readProjectConfig();
        assert.equal(logical.repositories[0].password, 'v1-secret');
        assert.equal(logical.repositories[0].passwordEncrypted, undefined);
        await reader.writeProjectConfig(logical);
        const rewritten = await readFile(configPath, 'utf8');
        assert.match(rewritten, /llmpkg-password-v2:/);
        assert.equal(rewritten.includes('v1-secret'), false);
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

    test('binds ciphertext to the repository endpoint', async () => {
        const { cwd, reader } = await fixture();
        await reader.writeProjectConfig({ repositories: [{ name: 'private', url: 'https://old.example.test/repo.git', password: 'secret' }] });
        const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
        const stored = JSON.parse(await readFile(configPath, 'utf8'));
        stored.repositories[0].url = 'https://new.example.test/repo.git';
        await writeFile(configPath, JSON.stringify(stored));
        await assert.rejects(() => reader.readProjectConfig());
    });

    test('removes encrypted credentials when an existing repository endpoint changes', async () => {
        const { cwd, reader } = await fixture();
        await reader.writeProjectConfig({ repositories: [{ name: 'private', url: 'https://old.example.test/repo.git', password: 'old-secret' }] });
        await addRepository({ name: 'private', url: 'https://new.example.test/repo.git' }, { configReader: reader });

        const reread = await reader.readProjectConfig();
        assert.equal(reread.repositories[0].url, 'https://new.example.test/repo.git');
        assert.equal(reread.repositories[0].password, undefined);
        assert.equal(reread.repositories[0].passwordEncrypted, undefined);
        const stored = await readFile(join(cwd, '.llmpkg', 'llmpkg.json'), 'utf8');
        assert.equal(stored.includes('old-secret'), false);
        assert.equal(stored.includes('passwordEncrypted'), false);
    });

    test('migrates legacy URL userinfo and gives separate legacy fields precedence', async () => {
        for (const [name, repository, expectedUsername, expectedPassword] of [
            ['embedded', { url: 'https://url-user:url-secret@example.test/repo.git' }, 'url-user', 'url-secret'],
            ['separate', { url: 'https://url-user:url-secret@example.test/repo.git', username: 'field-user', password: 'field-secret' }, 'field-user', 'field-secret'],
        ]) {
            const { cwd, reader } = await fixture();
            const configPath = join(cwd, '.llmpkg', 'llmpkg.json');
            await mkdir(join(cwd, '.llmpkg'), { recursive: true });
            await writeFile(configPath, JSON.stringify({ repositories: [{ name, ...repository }] }));

            const logical = await reader.readProjectConfig();
            assert.equal(logical.repositories[0].url, 'https://example.test/repo.git');
            assert.equal(logical.repositories[0].username, expectedUsername);
            assert.equal(logical.repositories[0].password, expectedPassword);
            assert.equal(logical.repositories[0].passwordEncrypted, undefined);
            await reader.writeProjectConfig(logical);

            const persisted = await readFile(configPath, 'utf8');
            assert.equal(persisted.includes('url-secret'), false);
            assert.equal(persisted.includes('field-secret'), false);
            assert.equal(persisted.includes('@example.test'), false);
            assert.match(persisted, /llmpkg-password-v2:/);
        }
    });

    test('fails closed on permission errors and tolerates only unsupported Windows chmod', async () => {
        const permissionError = Object.assign(new Error('permission denied'), { code: 'EPERM' });
        const deniedChmod = async () => { throw permissionError; };
        await assert.rejects(
            () => enforcePrivatePermissions('config.json', 0o600, { platform: 'linux', chmodImpl: deniedChmod }),
            (error) => error === permissionError,
        );
        await assert.rejects(
            () => enforcePrivatePermissions('config.json', 0o600, { platform: 'win32', chmodImpl: deniedChmod }),
            (error) => error === permissionError,
        );
        const unsupportedError = Object.assign(new Error('unsupported'), { code: 'ENOSYS' });
        await assert.doesNotReject(
            () => enforcePrivatePermissions('config.json', 0o600, { platform: 'win32', chmodImpl: async () => { throw unsupportedError; } }),
        );
    });
});
