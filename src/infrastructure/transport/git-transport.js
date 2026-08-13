/**
 * @module infrastructure/transport/git-transport
 * @description Generic Git implementations of repository contracts.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile, chmod } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

const execFileAsync = promisify(execFile);
const helperModulePath = fileURLToPath(new URL('./git-askpass.js', import.meta.url));
const sshHelperModulePath = fileURLToPath(new URL('./git-ssh.js', import.meta.url));

function safePath(root, ...segments) {
    const result = resolve(root, ...segments);
    const rel = relative(resolve(root), result);
    if (rel.startsWith('..') || rel === '..') {
        throw new LlmpkgError(ERROR_CODES.PATH_TRAVERSAL, 'Repository path escapes the checkout.');
    }
    return result;
}

export async function safeRealPath(root, ...segments) {
    const lexicalPath = safePath(root, ...segments);
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(lexicalPath)]);
    const rel = relative(realRoot, realTarget);
    if (rel.startsWith('..') || rel === '..') {
        throw new LlmpkgError(ERROR_CODES.PATH_TRAVERSAL, 'Repository symlink escapes the checkout.');
    }
    return realTarget;
}

export function prepareGitClone(repoConfig) {
    let url = repoConfig.url;
    let username = repoConfig.username ?? '';
    let password = repoConfig.password ?? '';
    let sshUsername = '';
    const scp = !url.includes('://') ? /^(?:([^/@\s:]+)@)?([^/:\s]+):(.+)$/.exec(url) : null;
    if (scp) {
        username ||= scp[1] ?? '';
        sshUsername = username;
        url = `${scp[2]}:${scp[3]}`;
    } else {
        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The Git repository URL is invalid.');
        }
        const encodedUsername = parsed.username;
        const encodedPassword = parsed.password;
        parsed.username = '';
        parsed.password = '';
        url = parsed.toString();
        try {
            username ||= decodeURIComponent(encodedUsername);
            password ||= decodeURIComponent(encodedPassword);
        } catch {
            throw new LlmpkgError(ERROR_CODES.AUTHENTICATION_REQUIRED, 'The Git repository credentials are malformed.');
        }
        if (parsed.protocol === 'ssh:') sshUsername = username;
    }
    return { url, username, password, sshUsername };
}

function mapGitError(error) {
    const output = `${error?.stderr ?? ''} ${error?.stdout ?? ''}`.toLowerCase();
    const auth = /authentication failed|permission denied|could not read username|access denied|publickey|password/.test(output);
    return new LlmpkgError(
        auth ? ERROR_CODES.AUTHENTICATION_REQUIRED : ERROR_CODES.REPOSITORY_UNAVAILABLE,
        auth ? 'Authentication is required to access the Git repository.' : 'The Git repository is unavailable or unreachable.',
    );
}

async function createAskPassLauncher(directory) {
    if (process.platform === 'win32') {
        const launcher = join(directory, 'llmpkg-askpass.cmd');
        await writeFile(launcher, `@\"${process.execPath}\" \"${helperModulePath}\" %*\r\n`, { mode: 0o700 });
        return launcher;
    }
    const launcher = join(directory, 'llmpkg-askpass.sh');
    await writeFile(launcher, `#!/bin/sh\nexec \"${process.execPath}\" \"${helperModulePath}\" \"$@\"\n`, { mode: 0o700 });
    await chmod(launcher, 0o700);
    return launcher;
}

export async function createSshLauncher(directory) {
    if (process.platform === 'win32') {
        const launcher = join(directory, 'llmpkg-ssh.cmd');
        await writeFile(launcher, `@\"${process.execPath}\" \"${sshHelperModulePath}\" %*\r\n`, { mode: 0o700 });
        return launcher;
    }
    const launcher = join(directory, 'llmpkg-ssh.sh');
    await writeFile(launcher, `#!/bin/sh\nexec \"${process.execPath}\" \"${sshHelperModulePath}\" \"$@\"\n`, { mode: 0o700 });
    await chmod(launcher, 0o700);
    return launcher;
}

const cleanupDirectories = new Set();
process.on('exit', () => {
    for (const dir of cleanupDirectories) {
        try { rmSync(dir, { recursive: true, force: true }); } catch (e) { }
    }
});
process.on('SIGINT', () => {
    process.exit(1);
});

const checkoutCache = new Map();

async function getSharedCheckout(repoConfig) {
    if (checkoutCache.has(repoConfig.url)) {
        return checkoutCache.get(repoConfig.url);
    }

    const checkoutPromise = (async () => {
        const directory = await mkdtemp(join(tmpdir(), 'llmpkg-git-'));
        cleanupDirectories.add(directory);

        const askPass = await createAskPassLauncher(directory);
        const clone = prepareGitClone(repoConfig);
        const sshLauncher = clone.sshUsername ? await createSshLauncher(directory) : undefined;
        const env = {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: askPass,
            SSH_ASKPASS: askPass,
            SSH_ASKPASS_REQUIRE: 'force',
            LLMPKG_GIT_USERNAME: clone.username,
            LLMPKG_GIT_PASSWORD: clone.password,
            ...(sshLauncher ? {
                GIT_SSH: sshLauncher,
                GIT_SSH_VARIANT: 'ssh',
                LLMPKG_GIT_SSH_USERNAME: clone.sshUsername,
            } : {}),
        };
        const checkout = join(directory, 'checkout');
        try {
            await execFileAsync('git', ['clone', '--depth', '1', '--', clone.url, checkout], {
                env,
                windowsHide: true,
                timeout: 120000,
                maxBuffer: 1024 * 1024,
            });
        } catch (error) {
            throw mapGitError(error);
        }
        return checkout;
    })();

    checkoutCache.set(repoConfig.url, checkoutPromise);
    return checkoutPromise;
}

async function withCheckout(repoConfig, action) {
    const checkout = await getSharedCheckout(repoConfig);
    return await action(checkout);
}

async function readJson(root, ...segments) {
    try {
        return JSON.parse(await readFile(await safeRealPath(root, ...segments), 'utf8'));
    } catch (error) {
        if (error instanceof LlmpkgError) throw error;
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'Required repository metadata is missing or invalid.');
    }
}

export function createGitRepositoryIndex(repoConfig) {
    async function getRegistry() {
        return withCheckout(repoConfig, (checkout) => readJson(checkout, 'registry.json'));
    }
    return {
        async searchPackages(query) {
            const registry = await getRegistry();
            const q = query.toLowerCase();
            return (Array.isArray(registry.packages) ? registry.packages : [])
                .filter((pkg) => pkg.name?.toLowerCase().includes(q) || pkg.description?.toLowerCase().includes(q))
                .map((pkg) => ({
                    name: pkg.name,
                    version: pkg.latestVersion ?? pkg.version ?? '0.0.0',
                    repository: repoConfig.name,
                    description: pkg.description ?? '',
                }));
        },
        async getPackageVersions(packageName) {
            const registry = await getRegistry();
            const found = (Array.isArray(registry.packages) ? registry.packages : []).find((pkg) => pkg.name === packageName);
            if (!found) return [];
            return Array.isArray(found.versions) ? found.versions : [found.version ?? found.latestVersion].filter(Boolean);
        },
    };
}

export function createGitManifestFetcher(repoConfig) {
    return {
        async fetchManifest(packageName, version) {
            return withCheckout(repoConfig, (checkout) => readJson(checkout, 'packages', packageName, version, 'manifest.json'));
        },
    };
}

export function createGitArtifactDownloader(repoConfig) {
    return {
        async downloadArtifact(artifact) {
            return withCheckout(repoConfig, async (checkout) => {
                try {
                    return await readFile(await safeRealPath(checkout, 'packages', artifact.path));
                } catch (error) {
                    if (error instanceof LlmpkgError) throw error;
                    throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The requested repository artifact is unavailable.');
                }
            });
        },
    };
}
