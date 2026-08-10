/**
 * @module errors
 * @description Domain error types for llmpkg protocol.
 * BusinessLogic layer — no I/O, no imports from upper layers.
 */

export const ERROR_CODES = Object.freeze({
    PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
    VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
    INVALID_MANIFEST: 'INVALID_MANIFEST',
    INTEGRITY_ERROR: 'INTEGRITY_ERROR',
    DEPENDENCY_CONFLICT: 'DEPENDENCY_CONFLICT',
    DEPENDENCY_CYCLE: 'DEPENDENCY_CYCLE',
    FILE_CONFLICT: 'FILE_CONFLICT',
    REPOSITORY_UNAVAILABLE: 'REPOSITORY_UNAVAILABLE',
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    UNSUPPORTED_PROTOCOL: 'UNSUPPORTED_PROTOCOL',
    INVALID_PACKAGE: 'INVALID_PACKAGE',
    INVALID_ARTIFACT: 'INVALID_ARTIFACT',
    PATH_TRAVERSAL: 'PATH_TRAVERSAL',
});

export class LlmpkgError extends Error {
    /**
     * @param {string} code - One of ERROR_CODES
     * @param {string} message - Human-readable message
     * @param {object} [details] - Additional context (never expose raw infra details to UI)
     */
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'LlmpkgError';
        this.code = code;
        this.details = details;
    }
}
