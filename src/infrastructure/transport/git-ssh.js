import { spawnSync } from 'node:child_process';

const username = process.env.LLMPKG_GIT_SSH_USERNAME ?? '';
const args = username ? ['-l', username, ...process.argv.slice(2)] : process.argv.slice(2);
const result = spawnSync('ssh', args, { stdio: 'inherit', windowsHide: true });

if (result.error) {
    process.exitCode = 1;
} else {
    process.exitCode = result.status ?? 1;
}
