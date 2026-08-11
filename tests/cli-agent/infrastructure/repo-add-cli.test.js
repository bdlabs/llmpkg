import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, '..', '..', '..');

describe('repo add CLI credential warnings', () => {
    let root;

    before(async () => {
        root = await mkdtemp(join(tmpdir(), 'llmpkg-cli-credentials-'));
    });

    after(async () => {
        await rm(root, { recursive: true, force: true });
    });

    async function run(args, cwd) {
        await mkdir(cwd, { recursive: true });
        return exec(process.execPath, [resolve(projectRoot, 'src', 'cli', 'main.js'), ...args], {
            cwd,
            env: { ...process.env, HOME: root, USERPROFILE: root },
        });
    }

    test('writes the local credential warning to stderr in text mode', async () => {
        const cwd = join(root, 'text-project');
        const { stdout, stderr } = await run(['repo', 'add', 'private', 'https://alice:secret@example.test/repo.git'], cwd);
        assert.match(stdout, /Added repository/);
        assert.equal(stdout.includes('secret'), false);
        assert.match(stderr, /Warning: Project-scoped repository credentials/);
        assert.equal(stderr.includes('secret'), false);
    });

    test('keeps JSON output valid and carries warnings in the JSON document', async () => {
        const cwd = join(root, 'json-project');
        const { stdout, stderr } = await run(['repo', 'add', 'private', 'https://alice:secret@example.test/repo.git', '--json'], cwd);
        const result = JSON.parse(stdout);
        assert.equal(result.url, 'https://example.test/repo.git');
        assert.equal(result.authenticated, true);
        assert.equal(result.warnings.length, 1);
        assert.equal(stdout.includes('secret'), false);
        assert.equal(stderr, '');
    });
});
