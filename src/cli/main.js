/**
 * @module cli/main
 * @description ApplicationLayer — CLI entry point, command routing, dependency wiring.
 *
 * Responsibilities (ONLY these):
 * - Parse argv (via InputAdapter)
 * - Wire concrete infrastructure implementations (DI)
 * - Route command → UseCase
 * - Pass result to OutputAdapter
 * - Write to stdout/stderr
 *
 * NOT allowed here:
 * - Business conditions (if version.major > 2 ...)
 * - Steps of a scenario (fetch manifest, then verify…) → LayerFusion antipattern
 * - Output formatting logic → AdapterLayer
 */

import { parseCliArgs } from './adapters/input/parse-args.js';
import {
    formatSearchResult, formatPackageInfo, formatInstallResult,
    formatUninstallResult, formatInstalledList, formatError,
    formatRepoAddResult, formatRepositoryList, formatRepoWarnings,
} from './adapters/output/text-formatter.js';
import { theme } from './adapters/output/theme.js';
import {
    formatSearchResultJson, formatPackageInfoJson, formatInstallResultJson,
    formatUninstallResultJson, formatInstalledListJson, formatErrorJson,
    formatRepoAddResultJson, formatRepositoryListJson
} from './adapters/output/json-formatter.js';

import * as SearchUseCase from '../application/search-use-case.js';
import * as InfoUseCase from '../application/info-use-case.js';
import * as InstallUseCase from '../application/install-use-case.js';
import * as UninstallUseCase from '../application/uninstall-use-case.js';
import * as RepoAddUseCase from '../application/repo-add-use-case.js';
import * as ListInstalledUseCase from '../application/list-installed-use-case.js';
import * as ListRepositoriesUseCase from '../application/list-repositories-use-case.js';
import { resolveConfig } from '../application/config-resolver.js';

import { createRepositoryIndex, createManifestFetcher, createArtifactDownloader } from '../infrastructure/transport/transport-factory.js';
import { createJsonPackageStore } from '../infrastructure/store/json-package-store.js';
import { createNodeFileSystem } from '../infrastructure/file-system/node-file-system.js';
import { createNoOpFileSystem } from '../infrastructure/file-system/noop-file-system.js';
import { createYamlConfigReader } from '../infrastructure/config/yaml-config-reader.js';

import { join } from 'node:path';
import { generateLogo } from './adapters/output/logo-generator.js';

function getHelpText() {
    const cmd = theme.primary('llmpkg');
    const b1 = theme.muted('[');
    const b2 = theme.muted(']');
    const opt = (name) => `${b1}${theme.label(name)}${b2}`;
    const arg = (name) => theme.success(`<${name}>`);

    // special parts:
    const ver = theme.muted('[@version]');
    const pkgOpt = `${b1}${arg('package')}${ver}${b2}`;

    return generateLogo('LLM PKG') + '\n\n' + theme.label('Usage:') + '\n' +
        `  ${cmd} ${theme.value('search')} ${arg('query')} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('info')} ${arg('package')}${ver} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('install')} ${pkgOpt} ${opt('--target <dir>')} ${opt('--dry-run')} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('uninstall')} ${arg('package')} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('list')} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('repo add')} ${arg('name')} ${arg('url')} ${opt('--username <login>')} ${opt('--password <password>')} ${opt('--global')}\n` +
        `  ${cmd} ${theme.value('repo list')} ${opt('--json')}\n` +
        `  ${cmd} ${theme.value('help')}`;
}

/**
 * Build the infrastructure dependencies (wiring).
 * This is the ONLY place concrete implementations are instantiated.
 * @param {{ config: import('../domain/contracts/config-reader.js').LlmpkgConfig, dryRun?: boolean }} opts
 */
function buildDeps({ config, dryRun = false, repository }) {
    const repoConfig = config.repositories.find((repo) => repo.name === repository)
        ?? config.repositories[0]
        ?? { name: 'default', url: '' };
    return {
        repositoryIndex: createRepositoryIndex(repoConfig),
        manifestFetcher: createManifestFetcher(config.repositories),
        artifactDownloader: createArtifactDownloader(config.repositories),
        packageStore: createJsonPackageStore(join(process.cwd(), '.llmpkg', 'installed.json')),
        fileSystem: dryRun ? createNoOpFileSystem() : createNodeFileSystem(),
        configReader: createYamlConfigReader(),
        config,
    };
}

/**
 * Run the CLI.
 * @param {string[]} [argv] - defaults to process.argv.slice(2)
 */
export async function runCli(argv = process.argv.slice(2)) {
    let useJson = false;
    try {
        const parsed = parseCliArgs(argv);
        useJson = parsed.json ?? false;

        if (parsed.command === 'help') {
            process.stdout.write(getHelpText() + '\n');
            return;
        }

        const configReader = createYamlConfigReader();
        const config = await resolveConfig(configReader);

        const deps = buildDeps({ config, dryRun: parsed.dryRun, repository: parsed.repository });

        const fmt = useJson
            ? { search: formatSearchResultJson, info: formatPackageInfoJson, install: formatInstallResultJson, uninstall: formatUninstallResultJson, list: formatInstalledListJson, repoAdd: formatRepoAddResultJson, repoList: formatRepositoryListJson }
            : { search: formatSearchResult, info: formatPackageInfo, install: formatInstallResult, uninstall: formatUninstallResult, list: formatInstalledList, repoAdd: formatRepoAddResult, repoList: formatRepositoryList };

        switch (parsed.command) {
            case 'search': {
                const result = await SearchUseCase.execute({ query: parsed.query }, deps);
                process.stdout.write(fmt.search(result) + '\n');
                break;
            }

            case 'info': {
                const result = await InfoUseCase.execute({ packageName: parsed.packageName, version: parsed.version }, deps);
                process.stdout.write(fmt.info(result) + '\n');
                break;
            }

            case 'install': {
                const result = await InstallUseCase.execute({
                    packageName: parsed.packageName,
                    version: parsed.version,
                    targetDir: parsed.targetDir,
                    dryRun: parsed.dryRun,
                    repository: parsed.repository,
                }, deps);
                process.stdout.write(fmt.install(result) + '\n');
                break;
            }

            case 'uninstall': {
                const result = await UninstallUseCase.execute({ packageName: parsed.packageName }, deps);
                process.stdout.write(fmt.uninstall(result) + '\n');
                break;
            }

            case 'list': {
                const result = await ListInstalledUseCase.execute({}, deps);
                process.stdout.write(fmt.list(result) + '\n');
                break;
            }

            case 'repo': {
                if (parsed.subcommand === 'list') {
                    const result = await ListRepositoriesUseCase.execute({}, deps);
                    process.stdout.write(fmt.repoList(result) + '\n');
                } else if (parsed.subcommand === 'add') {
                    const result = await RepoAddUseCase.execute({
                        name: parsed.name,
                        url: parsed.url,
                        global: parsed.global,
                        username: parsed.username,
                        password: parsed.password,
                    }, deps);
                    process.stdout.write(fmt.repoAdd(result) + '\n');
                    if (!useJson && result.warnings?.length) {
                        process.stderr.write(formatRepoWarnings(result) + '\n');
                    }
                }
                break;
            }

            default:
                process.stdout.write(getHelpText() + '\n');
        }
    } catch (error) {
        const formatted = useJson ? formatErrorJson(error) : formatError(error);
        process.stderr.write(formatted + '\n');
        process.exitCode = 1;
    }
}

// Entry point when run directly
// Entry point when run directly
import url from 'node:url';
const isMain = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;
if (isMain || (process.argv[1] && process.argv[1].match(/(main\.js|index\.js|llmpkg)$/))) {
    void runCli();
}
