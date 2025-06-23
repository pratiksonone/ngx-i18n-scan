import fs from 'fs';
import path from 'path';

export function detectHardcodedTextInHTML(directory: string): { file: string, line: number, text: string }[] {
    const results: { file: string, line: number, text: string }[] = [];

    function scanFile(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const regex = /(?:(?:>|^|\s)([A-Za-z\s]+?)(?=<|\s*{{|\s*$))|(?:(?:placeholder=")([^"]+?)(?="))|(?:(?:\[\w+\]="[^"]*?\?\s*['"]([^'"]+?)['"]\s*:\s*['"]([^'"]+?)['"][^"]*?"))|(?:(?:\?\s*['"]([^'"]+?)(?=['"])))|(?:(?::\s*['"]([^'"]+?)(?=['"])))/g;

        lines.forEach((line, index) => {
            // Skip lines that are entirely within HTML comments
            if (line.trim().startsWith('<!--') && line.trim().endsWith('-->')) {
                return;
            }

            let match;
            while ((match = regex.exec(line)) !== null) {
                let texts = [];
                if (match[1]) {
                    texts.push(match[1].trim());
                } else if (match[2]) {
                    texts.push(match[2].trim());
                } else if (match[3] && match[4]) {
                    texts.push(match[3].trim(), match[4].trim());
                } else if (match[5]) {
                    texts.push(match[5].trim());
                } else if (match[6]) {
                    texts.push(match[6].trim());
                }

                for (const text of texts) {
                    // Skip translation keys (e.g., text.*) and text already followed by | translate
                    if (
                        text.startsWith('text.') ||
                        line.includes(`'${text}' | translate`) ||
                        text.length < 3 ||
                        text.endsWith(':') ||
                        text.includes('| translate') ||
                        text.startsWith('{{') ||
                        text.startsWith('*') ||
                        !isNaN(Number(text))
                    ) {
                        continue;
                    }

                    results.push({file: filePath, line: index + 1, text});
                }
            }
        });
    }

    function walkDir(currentPath: string) {
        const entries = fs.readdirSync(currentPath);
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry);
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath);
            } else if (fullPath.endsWith('.html')) {
                scanFile(fullPath);
            }
        }
    }

    walkDir(directory);
    return results;
}