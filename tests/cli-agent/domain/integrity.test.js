import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeHash, verifyIntegrity, assertIntegrity } from '../../../src/domain/integrity.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/domain/errors.js';

describe('integrity — computeHash', () => {
    test('returns sha256: prefixed hex', () => {
        const hash = computeHash('hello world');
        assert.ok(hash.startsWith('sha256:'));
        assert.equal(hash.length, 7 + 64); // "sha256:" + 64 hex chars
    });

    test('is deterministic', () => {
        assert.equal(computeHash('test'), computeHash('test'));
    });

    test('differs for different data', () => {
        assert.notEqual(computeHash('a'), computeHash('b'));
    });
});

describe('integrity — verifyIntegrity', () => {
    test('returns true for matching hash', () => {
        const data = Buffer.from('hello');
        const hash = computeHash(data);
        assert.equal(verifyIntegrity(data, hash), true);
    });

    test('returns false for mismatching hash', () => {
        assert.equal(verifyIntegrity('hello', 'sha256:wrong'), false);
    });

    test('returns false for null/undefined hash', () => {
        assert.equal(verifyIntegrity('hello', null), false);
        assert.equal(verifyIntegrity('hello', undefined), false);
    });
});

describe('integrity — assertIntegrity', () => {
    test('does not throw when correct', () => {
        const data = 'test data';
        const hash = computeHash(data);
        assert.doesNotThrow(() => assertIntegrity(data, hash));
    });

    test('throws INTEGRITY_ERROR when hash mismatches', () => {
        assert.throws(
            () => assertIntegrity('data', 'sha256:badhash', 'myfile.md'),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INTEGRITY_ERROR,
        );
    });
});
