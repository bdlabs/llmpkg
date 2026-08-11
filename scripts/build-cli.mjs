import { build } from 'esbuild';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outDir = resolve(projectRoot, 'dist', 'cli');

async function buildCli() {
    await mkdir(outDir, { recursive: true });

    // 1. Bundle the CLI via esbuild
    await build({
        entryPoints: [resolve(projectRoot, 'src', 'cli', 'main.js')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node18',
        outfile: resolve(outDir, 'index.js'),
        banner: {
            js: '#!/usr/bin/env node',
        },
        minify: true,
    });

    // 2. Generate package.json for the CLI package
    const pkgJson = {
        name: "llmpkg",
        version: "1.0.0",
        description: "Open protocol for LLM resource distribution",
        main: "index.js",
        type: "module",
        bin: {
            "llmpkg": "./index.js"
        },
        engines: {
            "node": ">=18.0.0"
        }
    };

    await writeFile(
        resolve(outDir, 'package.json'),
        JSON.stringify(pkgJson, null, 2),
        'utf-8'
    );

    await copyFile(
        resolve(projectRoot, 'src', 'infrastructure', 'transport', 'git-askpass.js'),
        resolve(outDir, 'git-askpass.js'),
    );
    await copyFile(
        resolve(projectRoot, 'src', 'infrastructure', 'transport', 'git-ssh.js'),
        resolve(outDir, 'git-ssh.js'),
    );

    console.log(`CLI build complete: ${outDir}`);
}

buildCli().catch(err => {
    console.error('Error building CLI:', err);
    process.exit(1);
});
