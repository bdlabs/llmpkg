import { input, select, checkbox } from '@inquirer/prompts';
import * as SearchUseCase from '../application/search-use-case.js';
import * as ListInstalledUseCase from '../application/list-installed-use-case.js';
import * as InstallUseCase from '../application/install-use-case.js';
import * as UninstallUseCase from '../application/uninstall-use-case.js';
import { theme } from './adapters/output/theme.js';
import { generateLogo } from './adapters/output/logo-generator.js';

export async function runInteractive(deps) {
    console.log(generateLogo('LLM PKG TUI'));
    console.log(theme.muted('Welcome to the interactive package manager.\n'));

    // State of packages user intends to install
    const selectedForInstall = new Map(); // packageName -> version

    while (true) {
        const action = await select({
            message: `Main Menu (Cart: ${selectedForInstall.size} packages to install)`,
            choices: [
                { name: 'Search & Select packages to install', value: 'search' },
                { name: 'Manage installed packages (Uninstall)', value: 'manage' },
                {
                    name: `Install selected packages [${selectedForInstall.size}]`,
                    value: 'install',
                    disabled: selectedForInstall.size === 0 ? '(Cart is empty)' : false,
                },
                { name: 'Exit', value: 'exit' },
            ]
        });

        if (action === 'exit') {
            console.log(theme.muted('Bye!'));
            break;
        }

        if (action === 'search') {
            const query = await input({ message: 'Enter search query:' });
            if (!query.trim()) {
                console.log(theme.warning('\nSearch query cannot be empty.\n'));
                continue;
            }

            let searchResult;
            try {
                searchResult = await SearchUseCase.execute({ query }, deps);
            } catch (err) {
                console.log(theme.error(`\nError: ${err.message}\n`));
                continue;
            }

            if (searchResult.packages.length === 0) {
                console.log(theme.warning('\nNo packages found.\n'));
                continue;
            }

            const installed = await ListInstalledUseCase.execute({}, deps);
            const installedNames = new Set(installed.map((i) => i.name));

            const totalFound = searchResult.packages.length;
            const installedCountInResults = searchResult.packages.filter((p) => installedNames.has(p.name)).length;

            console.log(theme.muted(`\nFound ${totalFound} packages (${installedCountInResults} already installed locally).`));

            const choices = searchResult.packages.map((pkg) => {
                const isInstalled = installedNames.has(pkg.name);
                const isCurrentlySelected = selectedForInstall.has(pkg.name);

                let label = `${pkg.name} (v${pkg.latestVersion})`;
                if (isInstalled) label += theme.success(' [INSTALLED]');

                return {
                    name: label,
                    value: pkg,
                    checked: isCurrentlySelected,
                };
            });

            const selection = await checkbox({
                message: 'Select packages to ADD to your installation cart:',
                choices,
            });

            // Update cart: only for packages from THIS search result
            const resultNames = new Set(searchResult.packages.map((p) => p.name));

            // Remove those that were unchecked
            for (const name of resultNames) {
                if (selectedForInstall.has(name)) {
                    selectedForInstall.delete(name);
                }
            }

            // Add those that are checked
            for (const pkg of selection) {
                selectedForInstall.set(pkg.name, pkg.latestVersion);
            }

            console.log(theme.success(`\nCart updated. Now holding ${selectedForInstall.size} packages to install.\n`));
        }

        if (action === 'manage') {
            const installed = await ListInstalledUseCase.execute({}, deps);

            if (installed.length === 0) {
                console.log(theme.warning('\nNo packages are currently installed.\n'));
                continue;
            }

            const choices = installed.map((pkg) => ({
                name: `${pkg.name} (v${pkg.version})`,
                value: pkg.name,
                checked: true, // checked means "keep installed"
            }));

            const checkedToKeep = await checkbox({
                message: 'Select packages to KEEP (uncheck to UNINSTALL):',
                choices,
            });

            const keptNames = new Set(checkedToKeep);
            const toUninstall = installed.filter((pkg) => !keptNames.has(pkg.name));

            if (toUninstall.length > 0) {
                console.log(`\nUninstalling ${toUninstall.length} packages...`);
                for (const pkg of toUninstall) {
                    try {
                        await UninstallUseCase.execute({ packageName: pkg.name }, deps);
                        console.log(theme.success(`✓ Uninstalled ${pkg.name}`));

                        // If it was in the cart, maybe they changed their mind, clean it up just in case
                        if (selectedForInstall.has(pkg.name)) {
                            selectedForInstall.delete(pkg.name);
                        }
                    } catch (err) {
                        console.log(theme.error(`✗ Error uninstalling ${pkg.name}: ${err.message}`));
                    }
                }
                console.log('');
            } else {
                console.log(theme.muted('\nNo packages uninstalled.\n'));
            }
        }

        if (action === 'install') {
            const targetDir = await input({
                message: 'Enter target directory for installation (e.g. ./skills):',
                default: '.'
            });

            console.log(theme.primary(`\nInstalling ${selectedForInstall.size} packages to ${targetDir} ...`));

            let successCount = 0;
            for (const [name, version] of selectedForInstall.entries()) {
                console.log(theme.muted(`> Installing ${name}@${version} ...`));
                try {
                    await InstallUseCase.execute({
                        packageName: name,
                        version: version,
                        targetDir: targetDir,
                        dryRun: false,
                    }, deps);
                    console.log(theme.success(`✓ Installed ${name}`));
                    successCount++;
                } catch (err) {
                    console.log(theme.error(`✗ Failed to install ${name}: ${err.message}`));
                }
            }

            console.log(theme.success(`\nInstallation complete! (${successCount}/${selectedForInstall.size} succeeded)\n`));

            selectedForInstall.clear();
        }
    }
}
