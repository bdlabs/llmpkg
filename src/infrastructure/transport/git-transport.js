/**
 * @module infrastructure/transport/git-transport
 * @description Generic Git implementations of repository contracts.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LlmpkgError, ERROR_CODES } from '../../domain/errors.js';

const execFileAsync = promisify(execFile);
const helperModulePath = fileURLToPath(new URL('./git-askpass.js', import.meta.url));

function safePath(root, ...segments) {
    const result = resolve(root, ...segments);
    const rel = relative(resolve(root), result);
    if (rel.startsWith('..') || rel === '..') {
        throw new LlmpkgError(ERROR_CODES.PATH_TRAVERSAL, 'Repository path escapes the checkout.');
    }
    return result;
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

async function withCheckout(repoConfig, action) {
    const directory = await mkdtemp(join(tmpdir(), 'llmpkg-git-'));
    try {
        const askPass = await createAskPassLauncher(directory);
        const env = {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: askPass,
            SSH_ASKPASS: askPass,
            SSH_ASKPASS_REQUIRE: 'force',
            LLMPKG_GIT_USERNAME: repoConfig.username ?? '',
            LLMPKG_GIT_PASSWORD: repoConfig.password ?? '',
        };
        const checkout = join(directory, 'checkout');
        try {
            await execFileAsync('git', ['clone', '--depth', '1', '--', repoConfig.url, checkout], {
                env,
                windowsHide: true,
                timeout: 120000,
                maxBuffer: 1024 * 1024,
            });
        } catch (error) {
            throw mapGitError(error);
        }
        return await action(checkout);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

async function readJson(root, ...segments) {
    try {
        return JSON.parse(await readFile(safePath(root, ...segments), 'utf8'));
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
                    return await readFile(safePath(checkout, 'packages', artifact.path));
                } catch (error) {
                    if (error instanceof LlmpkgError) throw error;
                    throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The requested repository artifact is unavailable.');
                }
            });
        },
    };
}
