import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest } from '../../../src/domain/manifest.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/domain/errors.js';

const validRaw = {
    schema: 'llmpkg/v1',
    name: 'postgres-expert',
    version: '1.4.0',
    description: 'PostgreSQL tools',
    artifacts: [{ id: 'query-opt', type: 'skill', path: 'skills/query.md' }],
    dependencies: {},
};

describe('manifest — parseManifest', () => {
    test('parses valid manifest', () => {
        const pkg = parseManifest(validRaw, 'community');
        assert.equal(pkg.name, 'postgres-expert');
        assert.equal(pkg.version, '1.4.0');
        assert.equal(pkg.repository, 'community');
        assert.equal(pkg.artifacts.length, 1);
    });

    test('throws on missing schema', () => {
        const raw = { ...validRaw, schema: undefined };
        assert.throws(
            () => parseManifest(raw),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_MANIFEST,
        );
    });

    test('throws on unsupported schema', () => {
        const raw = { ...validRaw, schema: 'llmpkg/v99' };
        assert.throws(
            () => parseManifest(raw),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_MANIFEST,
        );
    });

    test('throws on missing name', () => {
        const raw = { ...validRaw, name: undefined };
        assert.throws(
            () => parseManifest(raw),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_MANIFEST,
        );
    });

    test('throws on missing version', () => {
        const raw = { ...validRaw, version: undefined };
        assert.throws(
            () => parseManifest(raw),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_MANIFEST,
        );
    });

    test('throws on null input', () => {
        assert.throws(
            () => parseManifest(null),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_MANIFEST,
        );
    });

    test('passes dependencies through', () => {
        const raw = { ...validRaw, dependencies: { 'sql-base': '^2.0.0' } };
        const pkg = parseManifest(raw);
        assert.deepEqual(pkg.dependencies, { 'sql-base': '^2.0.0' });
    });
});
