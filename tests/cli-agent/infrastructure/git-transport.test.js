import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
    createGitRepositoryIndex,
    createGitManifestFetcher,
    createGitArtifactDownloader,
    prepareGitClone,
    safeRealPath,
} from '../../../src/infrastructure/transport/git-transport.js';
import { findRepository, getTransportType } from '../../../src/infrastructure/transport/transport-factory.js';
import { ERROR_CODES } from '../../../src/domain/errors.js';

const exec = promisify(execFile);

describe('generic Git transport', () => {
    let root;
    let repository;
    const config = () => ({ name: 'private', url: repository });

    before(async () => {
        root = await mkdtemp(join(tmpdir(), 'llmpkg-git-test-'));
        repository = join(root, 'skills-hub.git');
        await mkdir(join(repository, 'packages', 'demo', '1.0.0'), { recursive: true });
        await mkdir(join(repository, 'packages', 'assets'), { recursive: true });
        await writeFile(join(repository, 'registry.json'), JSON.stringify({
            packages: [{ name: 'demo', latestVersion: '1.0.0', versions: ['1.0.0'], description: 'Demo skill' }],
        }));
        await writeFile(join(repository, 'packages', 'demo', '1.0.0', 'manifest.json'), JSON.stringify({ name: 'demo', version: '1.0.0' }));
        await writeFile(join(repository, 'packages', 'assets', 'demo.txt'), 'artifact');
        await exec('git', ['init'], { cwd: repository });
        await exec('git', ['add', '.'], { cwd: repository });
        await exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-m', 'fixture'], { cwd: repository });
    });

    after(async () => {
        await rm(root, { recursive: true, force: true });
    });

    test('detects generic Git URLs and preserves specialized transports', () => {
        assert.equal(getTransportType('ssh://git@ismartdev.pl:1922/home/git/repos/skills-hub.git'), 'git');
        assert.equal(getTransportType('git@example.test:repos/skills.git'), 'git');
        assert.equal(getTransportType('example.test:repos/skills'), 'git');
        assert.equal(getTransportType('https://gitlab.example.test/team/skills.git'), 'git');
        assert.equal(getTransportType('github:owner/repo'), 'github');
        assert.equal(getTransportType('https://registry.example.test'), 'http');
    });

    test('removes URL credentials before constructing Git arguments', () => {
        const clone = prepareGitClone({ url: 'https://alice:secret@example.test/repo.git' });
        assert.equal(clone.url, 'https://example.test/repo.git');
        assert.equal(clone.username, 'alice');
        assert.equal(clone.password, 'secret');
        assert.equal(clone.url.includes('secret'), false);
    });

    test('rejects malformed encoded userinfo before invoking Git', () => {
        assert.throws(
            () => prepareGitClone({ url: 'https://alice:sec%ZZret@example.test/repo.git' }),
            (error) => error.code === ERROR_CODES.AUTHENTICATION_REQUIRED && !error.message.includes('sec%ZZret'),
        );
    });

    test('uses configured SSH login for SCP-like URLs without userinfo', () => {
        const clone = prepareGitClone({ url: 'example.test:repos/skills', username: 'git', password: 'secret' });
        assert.equal(clone.url, 'example.test:repos/skills');
        assert.equal(clone.sshUsername, 'git');
        assert.equal(clone.password, 'secret');
    });

    test('selects credentials belonging to the requested repository URL', () => {
        const repositories = [
            { name: 'public', url: 'https://example.test/public' },
            { name: 'private', url: 'ssh://git@example.test/private.git', username: 'git', password: 'private-secret' },
        ];
        assert.equal(findRepository(repositories, repositories[1].url).password, 'private-secret');
    });

    test('rejects a symlink that resolves outside the checkout', async () => {
        const checkout = join(root, 'safe-checkout');
        const outside = join(root, 'outside');
        await mkdir(checkout);
        await mkdir(outside);
        await writeFile(join(outside, 'secret.txt'), 'secret');
        await symlink(outside, join(checkout, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
        await assert.rejects(
            () => safeRealPath(checkout, 'escape', 'secret.txt'),
            (error) => error.code === ERROR_CODES.PATH_TRAVERSAL,
        );
    });

    test('reads index, manifest and artifact from a Git checkout', async () => {
        const packages = await createGitRepositoryIndex(config()).searchPackages('demo');
        assert.deepEqual(packages.map((pkg) => pkg.name), ['demo']);
        assert.deepEqual(await createGitRepositoryIndex(config()).getPackageVersions('demo'), ['1.0.0']);
        assert.deepEqual(await createGitManifestFetcher(config()).fetchManifest('demo', '1.0.0'), { name: 'demo', version: '1.0.0' });
        const artifact = await createGitArtifactDownloader(config()).downloadArtifact({ path: 'assets/demo.txt' });
        assert.equal(artifact.toString(), 'artifact');
    });
});
