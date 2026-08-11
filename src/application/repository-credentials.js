import { LlmpkgError, ERROR_CODES } from '../domain/errors.js';

/**
 * Normalize a repository URL and extract embedded credentials.
 * Explicit credential fields are applied by callers after this translation.
 */
export function normalizeRepositoryInput(value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The repository URL is invalid.');
    }

    const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value)?.[1]?.toLowerCase();
    const hierarchicalScheme = ['http', 'https', 'ssh', 'git', 'file'].includes(scheme);
    if (!hierarchicalScheme) {
        const scp = /^(?:([^/@\s:]+)@)?([^/:\s]+):(.+)$/.exec(value);
        if (scp && (!value.includes('@') || value.indexOf('@') < value.indexOf(':'))) {
            return { url: `${scp[2]}:${scp[3]}`, username: scp[1] };
        }
        if (value.includes('@') || (scheme && value.slice(scheme.length + 1).includes(':'))) {
            throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The repository URL is invalid.');
        }
        return { url: value };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The repository URL is invalid.');
    }
    if (parsed.protocol !== 'file:' && !parsed.hostname) {
        throw new LlmpkgError(ERROR_CODES.REPOSITORY_UNAVAILABLE, 'The repository URL is invalid.');
    }

    try {
        const embedded = {
            username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        };
        parsed.username = '';
        parsed.password = '';
        return { url: parsed.toString(), ...embedded };
    } catch {
        throw new LlmpkgError(ERROR_CODES.AUTHENTICATION_REQUIRED, 'The repository URL contains malformed credentials.');
    }
}

/** Return a stable credential-binding identity for a normalized repository URL. */
export function repositoryEndpoint(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.hostname}:${url.port}`;
    } catch {
        const scp = /^(?:[^/@\s:]+@)?([^/:\s]+):/.exec(value);
        return scp ? `ssh://${scp[1]}` : value;
    }
}
