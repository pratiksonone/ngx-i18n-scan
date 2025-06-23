import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import {detectHardcodedTextInHTML, detectHardcodedTextInTS, replaceHardcodedTextInTS} from './hardcoded-scanner.js';

export function processHardcodedText(
    srcPath: string,
    jsonPath: string,
    options: { detectHardcoded?: boolean; replaceHardcoded?: boolean }
) {
    if (!options.detectHardcoded) {
        return;
    }

    console.log(chalk.yellow('\n🔎 Scanning for hardcoded text in Angular component files...'));
    const appFolderPath = path.join(srcPath, 'src', 'app');
    const htmlResults = detectHardcodedTextInHTML(appFolderPath);
    const tsResults = detectHardcodedTextInTS(appFolderPath);
    const hardcodedResults = [...htmlResults, ...tsResults];

    if (hardcodedResults.length === 0) {
        console.log(chalk.green('✅ No hardcoded text found.'));
        return;
    }

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

            // Ensure unique key
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
            if (file.endsWith('.html')) {
                let fileContent = fs.readFileSync(file, 'utf8');
                // Sort texts by length (descending) to prioritize longer strings
                const sortedTexts = texts.sort((a, b) => b.length - a.length);

                // Handle HTML replacements
                const ternaryRegex = /\{\{\s*([^?]+?)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]\s*\}\}/g;
                fileContent = fileContent.replace(ternaryRegex, (match, condition, trueText, falseText) => {
                    const trueKey = replacements[trueText] ? `'${replacements[trueText]}'` : `'${trueText}'`;
                    const falseKey = replacements[falseText] ? `'${replacements[falseText]}'` : `'${falseText}'`;
                    return `{{ (${condition.trim()} ? ${trueKey} : ${falseKey}) | translate }}`;
                });

                const dynamicPlaceholderRegex = /\[(\w+)\]="([^"]*?)\s*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]"/g;
                fileContent = fileContent.replace(dynamicPlaceholderRegex, (match, attr, condition, trueText, falseText) => {
                    const trueKey = replacements[trueText] ? `'${replacements[trueText]}'` : `'${trueText}'`;
                    const falseKey = replacements[falseText] ? `'${replacements[falseText]}'` : `'${falseText}'`;
                    return `[${attr}]="(${condition.trim()} ? ${trueKey} : ${falseKey}) | translate"`;
                });

                const staticPlaceholderRegex = /placeholder="([^"]+)"/g;
                fileContent = fileContent.replace(staticPlaceholderRegex, (match, text) => {
                    const key = replacements[text] ? replacements[text] : text;
                    return `placeholder="{{ '${key}' | translate }}"`;
                });

                sortedTexts.forEach(text => {
                    const key = replacements[text];
                    const escapedText = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    const textRegex = new RegExp(`(?!<!--[^>]*)(>|\\s)${escapedText}(?=<|\\s)(?![^<]*-->)`, 'g');
                    fileContent = fileContent.replace(textRegex, `$1{{ '${key}' | translate }}`);
                });

                fs.writeFileSync(file, fileContent, 'utf8');
                console.log(chalk.blue(`💾 Updated ${file}`));
            } else if (file.endsWith('.component.ts')) {
                // Handle TypeScript replacements
                replaceHardcodedTextInTS(file, replacements);
            }
        });

        fs.writeFileSync(jsonPath, JSON.stringify(translationJson, null, 2), 'utf8');
        console.log(chalk.green('\n✅ Hardcoded text replaced and translation JSON updated.\n'));
    } else {
        console.log(chalk.yellow('\nℹ️ Use --replace-hardcoded to auto-replace and update translation JSON.\n'));
    }
}