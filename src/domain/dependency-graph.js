/**
 * @module dependency-graph
 * @description Dependency resolution — domain rules.
 * BusinessLogic layer — pure graph algorithms, no I/O, no HTTP.
 *
 * Domain rule: cyclic dependencies are forbidden.
 */

import { LlmpkgError, ERROR_CODES } from './errors.js';

/**
 * Build an adjacency list from packages.
 * @param {Array<{ name: string, dependencies: Record<string, string> }>} packages
 * @returns {Map<string, string[]>}
 */
export function buildDependencyGraph(packages) {
    const graph = new Map();
    for (const pkg of packages) {
        graph.set(pkg.name, Object.keys(pkg.dependencies ?? {}));
    }
    return graph;
}

/**
 * Detect cycles in a dependency graph using DFS.
 * @param {Map<string, string[]>} graph
 * @returns {boolean} true if cycles exist
 */
export function detectCycles(graph) {
    const visited = new Set();
    const inStack = new Set();

    function dfs(node) {
        if (inStack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        inStack.add(node);
        for (const neighbor of (graph.get(node) ?? [])) {
            if (dfs(neighbor)) return true;
        }
        inStack.delete(node);
        return false;
    }

    for (const node of graph.keys()) {
        if (dfs(node)) return true;
    }
    return false;
}

/**
 * Return packages in installation order (dependents after dependencies).
 * Throws DEPENDENCY_CYCLE if the graph has cycles.
 * @param {Map<string, string[]>} graph
 * @returns {string[]} package names in install order
 */
export function resolveDependencyOrder(graph) {
    if (detectCycles(graph)) {
        throw new LlmpkgError(
            ERROR_CODES.DEPENDENCY_CYCLE,
            'Circular dependency detected. Cyclic dependencies are not allowed.',
        );
    }

    const visited = new Set();
    const order = [];

    function visit(node) {
        if (visited.has(node)) return;
        visited.add(node);
        for (const dep of (graph.get(node) ?? [])) {
            visit(dep);
        }
        order.push(node);
    }

    for (const node of graph.keys()) {
        visit(node);
    }

    return order;
}
