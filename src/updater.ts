import * as fs from 'fs';
import * as path from 'path';

export function updateJsonFile(jsonPath: string, newKeys: string[]) {
    const existing = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) : {};
    const updated = { ...existing };

    newKeys.forEach(key => {
        assignNestedValue(updated, key, '');
    });

    fs.writeFileSync(jsonPath, JSON.stringify(updated, null, 2));
    console.log(`✅ Updated: ${path.basename(jsonPath)} with ${newKeys.length} new keys.`);
}

function assignNestedValue(obj: any, keyPath: string, value: string) {
    const keys = keyPath.split('.');
    let current = obj;
    keys.forEach((key, idx) => {
        if (!current[key]) {
            current[key] = (idx === keys.length - 1) ? value : {};
        }
        current = current[key];
    });
}
