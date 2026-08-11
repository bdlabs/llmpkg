import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, '..', '..', '..');

test('CLI build includes the Git askpass helper', async () => {
    await exec(process.execPath, [resolve(projectRoot, 'scripts', 'build-cli.mjs')], { cwd: projectRoot });
    await assert.doesNotReject(() => access(resolve(projectRoot, 'dist', 'cli', 'git-askpass.js')));
});
