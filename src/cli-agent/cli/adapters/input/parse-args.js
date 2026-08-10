/**
 * @module cli/adapters/input/parse-args
 * @description InputAdapter — translates process.argv into Command DTOs.
 * AdapterLayer — format translation only. Does NOT validate business rules.
 * Does NOT decide whether a package exists (that's domain/application logic).
 *
 * Antipattern to avoid: DecidingAdapter — adapter must NOT check if the package exists.
 */

import { LlmpkgError, ERROR_CODES } from '../../../domain/errors.js';

/**
 * @typedef {{
 *   command: 'search'|'info'|'install'|'uninstall'|'repo'|'list'|'help',
 *   query?: string,
 *   packageName?: string,
 *   version?: string,
 *   targetDir?: string,
 *   dryRun?: boolean,
 *   repository?: string,
 *   subcommand?: string,
 *   name?: string,
 *   url?: string,
 *   json?: boolean,
 * }} ParsedArgs
 */

/**
 * Extract a named flag value from argv array.
 * e.g. ['install', 'pkg', '--target', './skills'] → './skills' for '--target'
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
function extractFlagValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
        return args[idx + 1];
    }
    return null;
}

/**
 * Parse CLI arguments into a structured Command DTO.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {ParsedArgs}
 */
export function parseCliArgs(argv) {
    if (!Array.isArray(argv) || argv.length === 0) {
        return { command: 'help', json: false };
    }

    const json = argv.includes('--json');
    const positional = argv.filter((a) => !a.startsWith('--'));
    const [cmd, ...rest] = positional;

    switch (cmd) {
        case 'search': {
            const query = rest[0];
            if (!query) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Usage: llmpkg search <query>');
            return { command: 'search', query, json };
        }

        case 'info': {
            const packageSpec = rest[0];
            if (!packageSpec) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Usage: llmpkg info <package>[@version]');
            const [packageName, version] = packageSpec.split('@');
            return { command: 'info', packageName, version, json };
        }

        case 'install': {
            const packageSpec = rest[0]; // May be undefined (project install)
            const targetDir = extractFlagValue(argv, '--target') ?? '.';
            const dryRun = argv.includes('--dry-run');
            const repository = extractFlagValue(argv, '--repo');
            if (packageSpec) {
                const [packageName, version] = packageSpec.split('@');
                return { command: 'install', packageName, version, targetDir, dryRun, repository, json };
            }
            // Project install (reads llmpkg.json)
            return { command: 'install', targetDir, dryRun, repository, json };
        }

        case 'uninstall': {
            const packageName = rest[0];
            if (!packageName) throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Usage: llmpkg uninstall <package>');
            return { command: 'uninstall', packageName, json };
        }

        case 'list': {
            return { command: 'list', json };
        }

        case 'repo': {
            const [subcommand, ...repoArgs] = rest;
            const global = argv.includes('--global');
            if (subcommand === 'add') {
                const [name, url] = repoArgs;
                if (!name || !url) {
                    throw new LlmpkgError(ERROR_CODES.INVALID_PACKAGE, 'Usage: llmpkg repo add <name> <url>');
                }
                return { command: 'repo', subcommand: 'add', name, url, global, json };
            }
            if (subcommand === 'list' || !subcommand) {
                return { command: 'repo', subcommand: 'list', json };
            }
            if (subcommand === 'remove') {
                return { command: 'repo', subcommand: 'remove', name: repoArgs[0], json };
            }
            throw new LlmpkgError(ERROR_CODES.UNSUPPORTED_PROTOCOL, `Unknown repo subcommand: "${subcommand}"`);
        }

        case 'help':
        case '--help':
        case '-h':
            return { command: 'help', json };

        default:
            throw new LlmpkgError(
                ERROR_CODES.UNSUPPORTED_PROTOCOL,
                `Unknown command: "${cmd}". Run "llmpkg help" for usage.`,
            );
    }
}
