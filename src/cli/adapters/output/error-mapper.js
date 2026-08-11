/**
 * @module cli/adapters/output/error-mapper
 * @description Provides a mapping for error codes to safe, human-readable messages.
 * Prevents TechnicalLeakage by ensuring raw infrastructure messages 
 * (like paths, URLs, Node errors) are not leaked in the CLI output.
 */

export function getSafeErrorMessage(error) {
    switch (error.code) {
        case 'PACKAGE_NOT_FOUND':
            return 'The requested package could not be found.';
        case 'VERSION_NOT_FOUND':
            return 'The requested version could not be found for the package.';
        case 'INVALID_MANIFEST':
            return 'The package manifest is invalid or could not be parsed.';
        case 'INTEGRITY_ERROR':
            return 'Package integrity check failed. The artifact may be corrupted.';
        case 'DEPENDENCY_CONFLICT':
            return 'A dependency conflict was detected. Cannot resolve constraints.';
        case 'DEPENDENCY_CYCLE':
            return 'A dependency cycle was detected and cannot be resolved.';
        case 'FILE_CONFLICT':
            return 'A file system conflict occurred. Cannot read or write files.';
        case 'REPOSITORY_UNAVAILABLE':
            return 'The repository is currently unavailable or unreachable.';
        case 'AUTHENTICATION_REQUIRED':
            return 'Authentication is required to access the repository.';
        case 'UNSUPPORTED_PROTOCOL':
            return 'The requested protocol is not supported.';
        case 'INVALID_PACKAGE':
            return 'The package name or metadata is invalid.';
        case 'INVALID_ARTIFACT':
            return 'The artifact configuration is invalid.';
        case 'PATH_TRAVERSAL':
            return 'A path traversal attempt was detected and blocked.';
        default:
            return 'An unexpected error occurred.';
    }
}
