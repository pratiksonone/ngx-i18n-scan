# 📦 ngx-i18n-scan

A powerful CLI tool for scanning Angular source code and managing i18n translation keys. It automatically extracts keys from your project and keeps your translation files (like `en.json`) clean and updated.

---

## ✨ Features

- ✅ Extracts i18n keys from Angular source files
- 🛠 Automatically adds missing keys to the JSON with `"TODO"` values
- 🧹 Detects and removes **unused** translation keys
- 🔁 Detects and removes **duplicate** keys
- 📋 Lists summary of all translation keys

---

## 📦 Installation

```bash
npm install -g ngx-i18n-scan
```

## 🚀 Usage

```bash
ngx-i18n-scan --src <source-folder> --json <translation-json> [options]
```

### Example

```bash
ngx-i18n-scan --src ./src --json ./assets/i18n/en.json
```

## ⚙️ Available Options

| Flag                  | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `--src`               | **(Required)** Path to your Angular source directory                |
| `--json`              | **(Required)** Path to your translation JSON file (e.g., `en.json`) |
| `--auto-update`       | Automatically add missing keys with `"TODO"` values                 |
| `--remove-unused`     | Remove unused translation keys from the JSON file                   |
| `--list-unused`       | Print unused keys found in the JSON file                            |
| `--remove-duplicates` | Remove duplicate keys from the JSON file                            |
| `--list-duplicates`   | Print duplicate keys found in the JSON file                         |


## 🧪 Example Commands

### ✅ Auto-update missing keys
```bash
ngx-i18n-scan --src "./src" --json "./assets/i18n/en.json" --auto-update
```

### 🧹 Remove unused keys
```bash
ngx-i18n-scan --src "./src" --json "./assets/i18n/en.json" --remove-unused
```

### 🔁 List and remove duplicate keys
```bash
ngx-i18n-scan --src "./src" --json "./assets/i18n/en.json" --list-duplicates --remove-duplicates
```

## 📂 Output Format

- The output JSON will always use a flat key format, like:
```json
{
  "user.login.success": "TODO",
  "user.login.error": "TODO"
}
```

## 📈 Output Summary

- After execution, the CLI prints:

```perl
✅ Present keys: 100
➕ New keys added: 20
🧹 Unused keys: 5
🔁 Duplicate keys: 2
```

## 👨‍💻 Author

> **Author:** Pratik Sonone