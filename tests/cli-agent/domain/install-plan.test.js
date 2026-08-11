import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createInstallPlan } from '../../../src/domain/install-plan.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/domain/errors.js';

const artifacts = [
    { id: 'query-opt', type: 'skill', path: 'skills/query.md' },
    { id: 'index-design', type: 'skill', path: 'skills/index.md' },
];

describe('install-plan — createInstallPlan', () => {
    test('creates plan with correct paths', () => {
        const plan = createInstallPlan({ artifacts, targetDir: '/target' });
        const paths = plan.getInstallPaths();
        assert.ok(paths.get('query-opt').endsWith('skills/query.md') || paths.get('query-opt').includes('skills'));
        assert.equal(paths.size, 2);
    });

    test('validate() passes for safe paths', () => {
        const plan = createInstallPlan({ artifacts, targetDir: '/safe/target' });
        assert.doesNotThrow(() => plan.validate());
    });

    test('throws PATH_TRAVERSAL for unsafe artifact path', () => {
        const badArtifacts = [{ id: 'x', type: 'skill', path: '../escape.md' }];
        const plan = createInstallPlan({ artifacts: badArtifacts, targetDir: '/target' });
        assert.throws(
            () => plan.validate(),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.PATH_TRAVERSAL,
        );
    });

    test('throws on missing targetDir', () => {
        assert.throws(
            () => createInstallPlan({ artifacts, targetDir: '' }),
            (e) => e instanceof LlmpkgError,
        );
    });
});
