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
} from './adapters/output/text-formatter.js';
import {
    formatSearchResultJson, formatPackageInfoJson, formatInstallResultJson,
    formatUninstallResultJson, formatInstalledListJson, formatErrorJson,
} from './adapters/output/json-formatter.js';

import * as SearchUseCase from '../application/search-use-case.js';
import * as InfoUseCase from '../application/info-use-case.js';
import * as InstallUseCase from '../application/install-use-case.js';
import * as UninstallUseCase from '../application/uninstall-use-case.js';

import { createHttpRepositoryIndex, createHttpManifestFetcher, createHttpArtifactDownloader } from '../infrastructure/transport/http-transport.js';
import { createJsonPackageStore } from '../infrastructure/store/json-package-store.js';
import { createNodeFileSystem } from '../infrastructure/file-system/node-file-system.js';
import { createNoOpFileSystem } from '../domain/contracts/file-system.js';
import { createYamlConfigReader } from '../infrastructure/config/yaml-config-reader.js';

import { join } from 'node:path';

const HELP_TEXT = `
llmpkg — open protocol for LLM resource distribution

Usage:
  llmpkg search <query> [--json]
  llmpkg info <package>[@version] [--json]
  llmpkg install [<package>[@version]] [--target <dir>] [--dry-run] [--json]
  llmpkg uninstall <package> [--json]
  llmpkg list [--json]
  llmpkg repo add <name> <url>
  llmpkg repo list [--json]
  llmpkg help
`.trim();

/**
 * Build the infrastructure dependencies (wiring).
 * This is the ONLY place concrete implementations are instantiated.
 * @param {{ config: import('../domain/contracts/config-reader.js').LlmpkgConfig, dryRun?: boolean }} opts
 */
function buildDeps({ config, dryRun = false }) {
    const repoConfig = config.repositories[0] ?? { name: 'default', url: '' };
    return {
        repositoryIndex: createHttpRepositoryIndex(repoConfig),
        manifestFetcher: createHttpManifestFetcher(),
        artifactDownloader: createHttpArtifactDownloader(),
        packageStore: createJsonPackageStore(join(process.cwd(), '.llmpkg', 'installed.json')),
        fileSystem: dryRun ? createNoOpFileSystem() : createNodeFileSystem(),
        configReader: createYamlConfigReader(),
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
            process.stdout.write(HELP_TEXT + '\n');
            return;
        }

        const configReader = createYamlConfigReader();
        const globalConfig = await configReader.readGlobalConfig();
        const projectConfig = await configReader.readProjectConfig();
        const config = { ...globalConfig, ...(projectConfig ?? {}) };

        const deps = buildDeps({ config, dryRun: parsed.dryRun });

        const fmt = useJson
            ? { search: formatSearchResultJson, info: formatPackageInfoJson, install: formatInstallResultJson, uninstall: formatUninstallResultJson, list: formatInstalledListJson }
            : { search: formatSearchResult, info: formatPackageInfo, install: formatInstallResult, uninstall: formatUninstallResult, list: formatInstalledList };

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
                const records = await deps.packageStore.listInstalled();
                process.stdout.write(fmt.list(records) + '\n');
                break;
            }

            case 'repo': {
                // Repo management — future: RepoAddUseCase
                if (parsed.subcommand === 'list') {
                    const repos = config.repositories ?? [];
                    if (useJson) {
                        process.stdout.write(JSON.stringify(repos, null, 2) + '\n');
                    } else {
                        process.stdout.write(repos.length === 0
                            ? 'No repositories configured.\n'
                            : repos.map((r) => `${r.name}  ${r.url}`).join('\n') + '\n');
                    }
                } else if (parsed.subcommand === 'add') {
                    process.stdout.write(`Repository management (add/remove) requires editing llmpkg.json or ~/.config/llmpkg/config.json.\nName: ${parsed.name}, URL: ${parsed.url}\n`);
                }
                break;
            }

            default:
                process.stdout.write(HELP_TEXT + '\n');
        }
    } catch (error) {
        const formatted = useJson ? formatErrorJson(error) : formatError(error);
        process.stderr.write(formatted + '\n');
        process.exitCode = 1;
    }
}

// Entry point when run directly
if (process.argv[1]?.endsWith('main.js')) {
    void runCli();
}
