import * as fs from 'fs';
import * as path from 'path';

const TRANSLATION_KEY_REGEXES = [
    /['"`]([a-zA-Z0-9_.-]+)['"`]\s*\|\s*translate/g,                             // HTML: {{ 'key' | translate }}
    /[\w$.]*translate\w*\s*\.\s*get\s*\(\s*['"`]([a-zA-Z0-9_.-]+)['"`]\s*\)/g,   // TS: this.translate.get('key'), translateService.get(...)
    /[\w$.]*translate\w*\s*\.\s*instant\s*\(\s*['"`]([a-zA-Z0-9_.-]+)['"`]\s*\)/g, // TS: translate.instant("key")
    /\(\s*[^?]+?\s*\?\s*['"`]([a-zA-Z0-9_.-]+)['"`]\s*:\s*['"`]([a-zA-Z0-9_.-]+)['"`]\s*\)\s*\|\s*translate/g // HTML: {{ (condition ? 'key1' : 'key2') | translate }} or [attr]="(condition ? 'key1' : 'key2') | translate"
];

export function extractKeysFromSource(srcDir: string): string[] {
    const files = getAllFiles(srcDir, ['.ts', '.html']);
    const keys: Set<string> = new Set();

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const regex of TRANSLATION_KEY_REGEXES) {
            let match: RegExpExecArray | null;
            while ((match = regex.exec(content)) !== null) {
                // Add all captured groups (for ternary expressions, capture both keys)
                if (match[1]) keys.add(match[1]);
                if (match[2]) keys.add(match[2]);
            }
        }
    }

    return Array.from(keys).sort();
}

function getAllFiles(dir: string, extensions: string[], fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getAllFiles(fullPath, extensions, fileList);
        } else if (extensions.includes(path.extname(entry.name))) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}