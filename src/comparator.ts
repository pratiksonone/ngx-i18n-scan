import * as fs from 'fs';

export function compareKeys(
    sourceKeys: string[],
    jsonFilePath: string,
    options: {
        addMissing?: boolean;
        listMissing?: boolean;
        removeUnused?: boolean;
        listUnused?: boolean;
        removeDuplicates?: boolean;
        listDuplicates?: boolean;
    } = {}
) {
    if (!fs.existsSync(jsonFilePath)) {
        throw new Error(`File not found: ${jsonFilePath}`);
    }

    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8').trim();
    let existingTranslations: Record<string, any> = {};

    // 🔁 Detect duplicate keys before JSON.parse
    const keyCountMap: Record<string, number> = {};
    const duplicateKeys: string[] = [];

    const keyPattern = /"([^"]+)"\s*:/g;
    let match;
    while ((match = keyPattern.exec(fileContent)) !== null) {
        const key = match[1];
        keyCountMap[key] = (keyCountMap[key] || 0) + 1;
    }

    for (const key in keyCountMap) {
        if (keyCountMap[key] > 1) {
            duplicateKeys.push(key);
        }
    }

    // ✅ Now safely parse JSON
    try {
        existingTranslations = fileContent ? JSON.parse(fileContent) : {};
    } catch (err) {
        console.error(`❌ Failed to parse JSON file: ${jsonFilePath}`);
        console.error(err);
        return;
    }

    const flatJson = flattenObject(existingTranslations);
    const jsonKeys = Object.keys(flatJson);

    const newKeys = sourceKeys.filter(k => !jsonKeys.includes(k));
    const unusedKeys = jsonKeys.filter(k => !sourceKeys.includes(k));
    const presentKeys = sourceKeys.filter(k => jsonKeys.includes(k));

    // 🧾 Logs
    if (options.listUnused && unusedKeys.length > 0) {
        console.log('\n🧹 Unused Keys:');
        unusedKeys.forEach(k => console.log(` - ${k}`));
    }

    if (options.listDuplicates && duplicateKeys.length > 0) {
        console.log('\n🔁 Duplicate Keys:');
        duplicateKeys.forEach(k => console.log(` - ${k} (count: ${keyCountMap[k]})`));
    }

    if (options.listMissing && newKeys.length > 0) {
        console.log('\n➕ Missing Keys:');
        newKeys.forEach(k => console.log(` - ${k}`));
    }

    // ✂️ Remove unused
    if (options.removeUnused && unusedKeys.length > 0) {
        unusedKeys.forEach(k => delete flatJson[k]);
        console.log(`\n🗑️ Removed ${unusedKeys.length} unused key(s).`);
    }

    // 🧹 Remove duplicates (just report + save again)
    if (options.removeDuplicates && duplicateKeys.length > 0) {
        console.log(`\n🧹 Removed ${duplicateKeys.length} duplicate key(s) (by overwriting on re-save).`);
        // No extra logic needed — JSON.parse() already handled the overwrite.
    }

    // ➕ Add update
    if (options.addMissing && newKeys.length > 0) {
        console.log(`\n🛠️ Auto-updating JSON with ${newKeys.length} new key(s)...`);
        newKeys.forEach(key => {
            flatJson[key] = 'TODO';
        });
    }

    // 💾 Write updated file
    if (options.addMissing || options.removeUnused || options.removeDuplicates) {
        fs.writeFileSync(jsonFilePath, JSON.stringify(flatJson, null, 2), 'utf-8');
        console.log(`✅ Updated file: ${jsonFilePath}`);
    }

    return { newKeys, unusedKeys, duplicateKeys, presentKeys };
}

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix ? `${prefix}.${k}` : k;
        if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
            Object.assign(acc, flattenObject(obj[k], pre));
        } else {
            acc[pre] = obj[k];
        }
        return acc;
    }, {} as Record<string, string>);
}
