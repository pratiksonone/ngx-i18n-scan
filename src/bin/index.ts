#!/usr/bin/env node

import {Command} from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import {extractKeysFromSource} from '../scanner.js';
import {compareKeys} from '../comparator.js';
import {detectHardcodedTextInHTML} from '../hardcoded-scanner.js';

// 🔍 Helper: Find i18n folder and JSON files
function findI18nJsonFiles(startPath: string): string[] {
    const result: string[] = [];

    function recursiveSearch(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                if (entry.name.toLowerCase() === 'i18n') {
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
    .option('--list-duplicates', 'List duplicate keys from JSON')
    .option('--detect-hardcoded', 'Detect hardcoded text in templates and components')
    .option('--replace-hardcoded', 'Automatically replace hardcoded text with translation keys');

program.parse(process.argv);
const options = program.opts();

const rootDir = process.cwd();
const srcPath = options.src || rootDir;

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
        console.log(chalk.gray(`📄 Using detected translation file:`), chalk.cyan(foundJsonFiles[0]));
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
    console.log(chalk.blue.bold('\n🔍 Starting ngx-i18n-scan...'));
    console.log(chalk.gray(`\n📁 Source Directory:`), chalk.cyan(srcPath));

    if (!fs.existsSync(srcPath)) {
        console.log(chalk.red(`❌ Source path does not exist: ${srcPath}`));
        process.exit(1);
    }

    const jsonPath = await resolveJsonPath();

    // ✅ Step: Detect hardcoded text in HTML
    if (options.detectHardcoded) {
        console.log(chalk.yellow('\n🔎 Scanning for hardcoded text in HTML files...'));
        const appFolderPath = path.join(srcPath, "src", "app");
        const hardcodedResults = detectHardcodedTextInHTML(appFolderPath);

        if (hardcodedResults.length === 0) {
            console.log(chalk.green('✅ No hardcoded text found.'));
        } else {
            console.log(chalk.magenta(`🔍 Found ${hardcodedResults.length} hardcoded string(s):`));

            const replacements: { [key: string]: string } = {};
            const translationJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            const generatedKeys = new Set<string>();
            const usedTexts = new Set<string>();

            // Map existing JSON keys to their values for quick lookup
            const existingKeyToValue: { [key: string]: string } = {};
            Object.entries(translationJson).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    existingKeyToValue[key] = value;
                }
            });

            hardcodedResults.forEach((item, index) => {
                if (usedTexts.has(item.text)) return;
                usedTexts.add(item.text);

                // Check if text already has a matching key in JSON
                let key: string | undefined;
                for (const [existingKey, value] of Object.entries(existingKeyToValue)) {
                    if (value === item.text && !generatedKeys.has(existingKey)) {
                        key = existingKey;
                        break;
                    }
                }

                if (!key) {
                    // Generate dot-separated key prefixed with 'text.'
                    let keyBase = item.text
                        .toLowerCase()
                        .replace(/[^a-z0-9\s]/g, '')
                        .trim()
                        .split(/\s+/)
                        .join('.');
                    key = `text.${keyBase}`;
                    let suffix = 1;

                    // Ensure unique key, only appending suffix if needed
                    while (translationJson[key] && translationJson[key] !== item.text || generatedKeys.has(key)) {
                        key = `text.${keyBase}.${suffix++}`;
                    }
                }

                generatedKeys.add(key);
                console.log(`${index + 1}. ${chalk.cyan(item.text)} ➜ ${chalk.yellow(key)}`);
                replacements[item.text] = key;
                translationJson[key] = item.text;
            });

            if (options.replaceHardcoded) {
                const grouped = hardcodedResults.reduce((acc, cur) => {
                    if (!acc[cur.file]) acc[cur.file] = [];
                    if (!acc[cur.file].includes(cur.text)) acc[cur.file].push(cur.text);
                    return acc;
                }, {} as { [file: string]: string[] });

                Object.entries(grouped).forEach(([file, texts]) => {
                    let fileContent = fs.readFileSync(file, 'utf8');

                    // Sort texts by length (descending) to prioritize longer strings
                    const sortedTexts = texts.sort((a, b) => b.length - a.length);

                    // Handle ternary expressions in {{ ... }}
                    const ternaryRegex = /\{\{\s*([^?]+?)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]\s*\}\}/g;
                    fileContent = fileContent.replace(ternaryRegex, (match, condition, trueText, falseText) => {
                        const trueKey = replacements[trueText] ? `'${replacements[trueText]}'` : `'${trueText}'`;
                        const falseKey = replacements[falseText] ? `'${replacements[falseText]}'` : `'${falseText}'`;
                        return `{{ (${condition.trim()} ? ${trueKey} : ${falseKey}) | translate }}`;
                    });

                    // Handle dynamic placeholders like [placeholder]="..."
                    const dynamicPlaceholderRegex = /\[(\w+)\]="([^"]*?)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]"/g;
                    fileContent = fileContent.replace(dynamicPlaceholderRegex, (match, attr, condition, trueText, falseText) => {
                        const trueKey = replacements[trueText] ? `'${replacements[trueText]}'` : `'${trueText}'`;
                        const falseKey = replacements[falseText] ? `'${replacements[falseText]}'` : `'${falseText}'`;
                        return `[${attr}]="(${condition.trim()} ? ${trueKey} : ${falseKey}) | translate"`;
                    });

                    // Handle static placeholders like placeholder="..."
                    const staticPlaceholderRegex = /placeholder="([^"]+)"/g;
                    fileContent = fileContent.replace(staticPlaceholderRegex, (match, text) => {
                        const key = replacements[text] ? replacements[text] : text;
                        return `placeholder="{{ '${key}' | translate }}"`;
                    });

                    // Handle standalone text, prioritizing longer strings and excluding comments
                    sortedTexts.forEach(text => {
                        const key = replacements[text];
                        const escapedText = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        // Match text outside of comments
                        const textRegex = new RegExp(`(?!<!--[^>]*)(>|\\s)${escapedText}(?=<|\\s)(?![^<]*-->)`, 'g');
                        fileContent = fileContent.replace(textRegex, `$1{{ '${key}' | translate }}`);
                    });

                    fs.writeFileSync(file, fileContent, 'utf8');
                    console.log(chalk.blue(`💾 Updated ${file}`));
                });

                fs.writeFileSync(jsonPath, JSON.stringify(translationJson, null, 2), 'utf8');
                console.log(chalk.green('\n✅ Hardcoded text replaced and translation JSON updated.\n'));
            } else {
                console.log(chalk.yellow('\nℹ️ Use --replace-hardcoded to auto-replace and update translation JSON.\n'));
            }

            // Exit if user is only using this feature
            if (!options.addMissing && !options.listMissing && !options.removeUnused && !options.listUnused) {
                process.exit(0);
            }
        }
    }

    // ✅ Step: Extract translation keys
    console.log(chalk.yellow('\n⏳ Extracting translation keys from source files...'));
    const sourceKeys = extractKeysFromSource(srcPath);
    console.log(chalk.green(`✅ Extracted ${sourceKeys.length} key(s) from source.`));

    // ✅ Step: Compare with translation file
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

    // ✅ Summary Report
    console.log("\n📊 " + chalk.magenta.bold(' Summary Report:\n'));
    console.log(chalk.white(`- Present keys: `) + chalk.green(presentKeys.length));
    console.log(chalk.white(`- New keys to add: `) + chalk.blue(newKeys.length));
    console.log(chalk.white(`- Unused keys: `) + chalk.yellow(unusedKeys.length));
    console.log(chalk.white(`- Duplicate keys: `) + chalk.red(duplicateKeys.length));

    console.log(chalk.green.bold('\n✅ ngx-i18n-scan process completed.\n'));
})();