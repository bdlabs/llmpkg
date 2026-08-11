import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../../../src/cli/adapters/input/parse-args.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/domain/errors.js';

describe('parseCliArgs — search', () => {
    test('parses search command', () => {
        const result = parseCliArgs(['search', 'postgres']);
        assert.equal(result.command, 'search');
        assert.equal(result.query, 'postgres');
        assert.equal(result.json, false);
    });

    test('parses search with --json flag', () => {
        const result = parseCliArgs(['search', 'postgres', '--json']);
        assert.equal(result.json, true);
    });

    test('throws on missing query', () => {
        assert.throws(
            () => parseCliArgs(['search']),
            LlmpkgError,
        );
    });
});

describe('parseCliArgs — info', () => {
    test('parses info command', () => {
        const r = parseCliArgs(['info', 'postgres-expert']);
        assert.equal(r.command, 'info');
        assert.equal(r.packageName, 'postgres-expert');
        assert.equal(r.version, undefined);
    });

    test('parses info with version', () => {
        const r = parseCliArgs(['info', 'postgres-expert@1.4.0']);
        assert.equal(r.packageName, 'postgres-expert');
        assert.equal(r.version, '1.4.0');
    });
});

describe('parseCliArgs — install', () => {
    test('parses install with target', () => {
        const r = parseCliArgs(['install', 'pkg', '--target', './skills']);
        assert.equal(r.command, 'install');
        assert.equal(r.packageName, 'pkg');
        assert.equal(r.targetDir, './skills');
        assert.equal(r.dryRun, false);
    });

    test('parses install with --dry-run', () => {
        const r = parseCliArgs(['install', 'pkg', '--dry-run']);
        assert.equal(r.dryRun, true);
    });

    test('parses install with version', () => {
        const r = parseCliArgs(['install', 'pkg@1.2.0']);
        assert.equal(r.packageName, 'pkg');
        assert.equal(r.version, '1.2.0');
    });

    test('parses project install (no package name)', () => {
        const r = parseCliArgs(['install']);
        assert.equal(r.command, 'install');
        assert.equal(r.packageName, undefined);
    });
});

describe('parseCliArgs — uninstall', () => {
    test('parses uninstall', () => {
        const r = parseCliArgs(['uninstall', 'pkg']);
        assert.equal(r.command, 'uninstall');
        assert.equal(r.packageName, 'pkg');
    });

    test('throws on missing package name', () => {
        assert.throws(() => parseCliArgs(['uninstall']), LlmpkgError);
    });
});

describe('parseCliArgs — repo', () => {
    test('parses repo add', () => {
        const r = parseCliArgs(['repo', 'add', 'community', 'https://example.org']);
        assert.equal(r.command, 'repo');
        assert.equal(r.subcommand, 'add');
        assert.equal(r.name, 'community');
        assert.equal(r.url, 'https://example.org');
    });

    test('parses repository credentials', () => {
        const r = parseCliArgs(['repo', 'add', 'private', 'ssh://git@example.test:2222/repos/private.git', '--username', 'alice', '--password', 'secret']);
        assert.equal(r.username, 'alice');
        assert.equal(r.password, 'secret');
    });

    test('parses repo list', () => {
        const r = parseCliArgs(['repo', 'list']);
        assert.equal(r.command, 'repo');
        assert.equal(r.subcommand, 'list');
    });
});

describe('parseCliArgs — edge cases', () => {
    test('empty argv returns help', () => {
        const r = parseCliArgs([]);
        assert.equal(r.command, 'help');
    });

    test('unknown command throws', () => {
        assert.throws(
            () => parseCliArgs(['unknowncmd']),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.UNSUPPORTED_PROTOCOL,
        );
    });
});
