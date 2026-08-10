import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createArtifact, isPathSafe, ARTIFACT_TYPES } from '../../../src/cli-agent/domain/artifact.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/cli-agent/domain/errors.js';

describe('artifact — isPathSafe', () => {
    test('accepts relative paths', () => {
        assert.equal(isPathSafe('skills/query.md'), true);
        assert.equal(isPathSafe('nested/sub/file.md'), true);
    });

    test('rejects absolute paths', () => {
        assert.equal(isPathSafe('/etc/passwd'), false);
    });

    test('rejects path traversal with ../', () => {
        assert.equal(isPathSafe('../escape.md'), false);
        assert.equal(isPathSafe('foo/../../../etc/passwd'), false);
        assert.equal(isPathSafe('..'), false);
    });

    test('rejects empty or non-string', () => {
        assert.equal(isPathSafe(''), false);
        assert.equal(isPathSafe(null), false);
        assert.equal(isPathSafe(undefined), false);
    });
});

describe('artifact — createArtifact', () => {
    test('creates valid artifact', () => {
        const a = createArtifact({ id: 'query-opt', type: 'skill', path: 'skills/query.md' });
        assert.equal(a.id, 'query-opt');
        assert.equal(a.type, 'skill');
        assert.equal(a.path, 'skills/query.md');
    });

    test('throws on missing id', () => {
        assert.throws(
            () => createArtifact({ id: '', type: 'skill', path: 'a.md' }),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.INVALID_ARTIFACT,
        );
    });

    test('accepts unknown types as valid strings', () => {
        const a = createArtifact({ id: 'x', type: 'unknown-type', path: 'a.md' });
        assert.equal(a.type, 'unknown-type');
    });

    test('throws on path traversal', () => {
        assert.throws(
            () => createArtifact({ id: 'x', type: 'skill', path: '../escape.md' }),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.PATH_TRAVERSAL,
        );
    });

    test('artifact is frozen', () => {
        const a = createArtifact({ id: 'x', type: 'skill', path: 'a.md' });
        assert.throws(() => { a.id = 'modified'; }, TypeError);
    });

    test('ARTIFACT_TYPES includes expected types', () => {
        assert.ok(ARTIFACT_TYPES.includes('skill'));
        assert.ok(ARTIFACT_TYPES.includes('workflow'));
        assert.ok(ARTIFACT_TYPES.includes('prompt'));
    });
});
