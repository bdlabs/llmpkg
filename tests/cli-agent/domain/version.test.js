import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, satisfiesConstraint, resolveBestVersion, SUPPORTED_SCHEMA } from '../../../src/cli-agent/domain/version.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/cli-agent/domain/errors.js';

describe('version — parseVersion', () => {
    test('parses valid semver', () => {
        const v = parseVersion('1.2.3');
        assert.deepEqual(v, { major: 1, minor: 2, patch: 3 });
    });

    test('throws on invalid format', () => {
        assert.throws(() => parseVersion('abc'), (e) => e instanceof LlmpkgError);
        assert.throws(() => parseVersion(''), (e) => e instanceof LlmpkgError);
        assert.throws(() => parseVersion(null), (e) => e instanceof LlmpkgError);
    });
});

describe('version — compareVersions', () => {
    test('returns 0 for equal versions', () => {
        assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
    });

    test('returns 1 when a is greater', () => {
        assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
        assert.equal(compareVersions('1.3.0', '1.2.9'), 1);
        assert.equal(compareVersions('1.2.4', '1.2.3'), 1);
    });

    test('returns -1 when a is lesser', () => {
        assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
    });
});

describe('version — satisfiesConstraint', () => {
    test('exact constraint', () => {
        assert.equal(satisfiesConstraint('1.2.3', '1.2.3'), true);
        assert.equal(satisfiesConstraint('1.2.4', '1.2.3'), false);
    });

    test('caret constraint (^)', () => {
        assert.equal(satisfiesConstraint('1.5.0', '^1.2.0'), true);
        assert.equal(satisfiesConstraint('1.1.9', '^1.2.0'), false);
        assert.equal(satisfiesConstraint('2.0.0', '^1.2.0'), false);
    });

    test('tilde constraint (~)', () => {
        assert.equal(satisfiesConstraint('1.2.5', '~1.2.3'), true);
        assert.equal(satisfiesConstraint('1.2.2', '~1.2.3'), false);
        assert.equal(satisfiesConstraint('1.3.0', '~1.2.3'), false);
    });
});

describe('version — resolveBestVersion', () => {
    test('returns newest satisfying version', () => {
        const best = resolveBestVersion(['1.0.0', '1.2.0', '1.3.0', '2.0.0'], '^1.0.0');
        assert.equal(best, '1.3.0');
    });

    test('returns null when nothing satisfies', () => {
        const best = resolveBestVersion(['1.0.0', '1.1.0'], '^2.0.0');
        assert.equal(best, null);
    });
});

describe('SUPPORTED_SCHEMA', () => {
    test('is llmpkg/v1', () => {
        assert.equal(SUPPORTED_SCHEMA, 'llmpkg/v1');
    });
});
