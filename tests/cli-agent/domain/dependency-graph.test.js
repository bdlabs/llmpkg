import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDependencyGraph,
    detectCycles,
    resolveDependencyOrder,
} from '../../../src/cli-agent/domain/dependency-graph.js';
import { LlmpkgError, ERROR_CODES } from '../../../src/cli-agent/domain/errors.js';

const pkgA = { name: 'a', dependencies: { b: '^1.0.0' } };
const pkgB = { name: 'b', dependencies: {} };
const pkgC = { name: 'c', dependencies: { a: '^1.0.0' } };

describe('dependency-graph — buildDependencyGraph', () => {
    test('builds adjacency list', () => {
        const graph = buildDependencyGraph([pkgA, pkgB]);
        assert.deepEqual(graph.get('a'), ['b']);
        assert.deepEqual(graph.get('b'), []);
    });
});

describe('dependency-graph — detectCycles', () => {
    test('returns false for acyclic graph', () => {
        const graph = buildDependencyGraph([pkgA, pkgB]);
        assert.equal(detectCycles(graph), false);
    });

    test('returns true for cyclic graph', () => {
        // a → b → a
        const cyclic = new Map([['a', ['b']], ['b', ['a']]]);
        assert.equal(detectCycles(cyclic), true);
    });

    test('self-dependency is a cycle', () => {
        const graph = new Map([['a', ['a']]]);
        assert.equal(detectCycles(graph), true);
    });
});

describe('dependency-graph — resolveDependencyOrder', () => {
    test('returns packages in dependency-first order', () => {
        const graph = buildDependencyGraph([pkgA, pkgB]);
        const order = resolveDependencyOrder(graph);
        assert.ok(order.indexOf('b') < order.indexOf('a'));
    });

    test('throws DEPENDENCY_CYCLE on cycle', () => {
        const cyclic = new Map([['a', ['b']], ['b', ['a']]]);
        assert.throws(
            () => resolveDependencyOrder(cyclic),
            (e) => e instanceof LlmpkgError && e.code === ERROR_CODES.DEPENDENCY_CYCLE,
        );
    });
});
