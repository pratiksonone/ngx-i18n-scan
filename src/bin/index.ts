#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { extractKeysFromSource } from '../scanner.js';
import { compareKeys } from '../comparator.js';

// Helper to find i18n folder and JSON files
function findI18nJsonFiles(startPath: string): string[] {
    const result: string[] = [];

    function recursiveSearch(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (entry.name.toLowerCase() === 'i18n') {
                    // collect all .json files in i18n folder
                    const jsons = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));
                    result.push(...jsons.map(j => path.join(fullPath, j)));
                } else {
                    recursiveSearch(fullPath);
                }
            }
        }
    }

    recursiveSearch(startPath);
    return result;
}

const program = new Command();

program
    .name('ngx-i18n-scan')
    .description('A CLI tool to scan and manage translation keys in Angular projects.')
    .option('--src <path>', 'Path to source directory (default: ./src)', '')
    .option('--json <path>', 'Path to translation JSON file')
    .option('--add-missing', 'Auto update JSON with missing keys')
    .option('--list-missing', 'List missing keys from JSON')
    .option('--remove-unused', 'Remove unused keys from JSON')
    .option('--list-unused', 'List unused keys from JSON')
    .option('--remove-duplicates', 'Remove duplicate keys from JSON')
    .option('--list-duplicates', 'List duplicate keys from JSON');

program.parse(process.argv);
const options = program.opts();

const rootDir = process.cwd();
const srcPath = options.src || rootDir;

// ✅ Step 1: Smart JSON detection if not provided
async function resolveJsonPath(): Promise<string> {
    if (options.json && fs.existsSync(options.json)) {
        return options.json;
    }

    const foundJsonFiles = findI18nJsonFiles(rootDir);

    if (foundJsonFiles.length === 0) {
        console.log(chalk.red(`❌ No translation JSON files found in project (looked for ./i18n folders)`));
        process.exit(1);
    }

    if (foundJsonFiles.length === 1) {
        console.log(chalk.gray(`📄  Using detected translation file:`), chalk.cyan(foundJsonFiles[0]));
        return foundJsonFiles[0];
    }

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedFile',
            message: '🌍 Multiple translation files found. Please select one:',
            choices: foundJsonFiles
        }
    ]);

    return answer.selectedFile;
}

(async () => {
    console.log(chalk.blue.bold('\n🔍  Starting ngx-i18n-scan...'));
    console.log(chalk.gray(`\n📁  Source Directory:`), chalk.cyan(srcPath));

    if (!fs.existsSync(srcPath)) {
        console.log(chalk.red(`❌ Source path does not exist: ${srcPath}`));
        process.exit(1);
    }

    const jsonPath = await resolveJsonPath();

    // ✅ Step 2: Extract keys
    console.log(chalk.yellow('\n⏳ Extracting translation keys from source files...'));
    const sourceKeys = extractKeysFromSource(srcPath);
    console.log(chalk.green(`✅ Extracted ${sourceKeys.length} key(s) from source.`));

    // ✅ Step 3: Compare
    console.log(chalk.yellow('\n⏳ Comparing source keys with translation JSON...'));
    const result = compareKeys(sourceKeys, jsonPath, {
        addMissing: options.addMissing,
        listMissing: options.listMissing,
        removeUnused: options.removeUnused,
        listUnused: options.listUnused,
        removeDuplicates: options.removeDuplicates,
        listDuplicates: options.listDuplicates
    });

    if (!result) {
        console.log(chalk.red('❌ Failed to compare keys. Exiting.'));
        process.exit(1);
    }

    const { newKeys, unusedKeys, duplicateKeys, presentKeys } = result;

    // ✅ Step 4: Summary
    console.log("\n📊 " + chalk.magenta.bold(' Summary Report:\n'));
    console.log(chalk.white(`- Present keys: `) + chalk.green(presentKeys.length));
    console.log(chalk.white(`- New keys to add: `) + chalk.blue(newKeys.length));
    console.log(chalk.white(`- Unused keys: `) + chalk.yellow(unusedKeys.length));
    console.log(chalk.white(`- Duplicate keys: `) + chalk.red(duplicateKeys.length));

    console.log(chalk.green.bold('\n✅ ngx-i18n-scan process completed.\n'));
})();
