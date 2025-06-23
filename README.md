# 📦 ngx-i18n-scan

A powerful and user-friendly CLI tool for managing internationalization (i18n) in Angular projects. It scans source code to extract translation keys, updates translation JSON files, and detects/replaces hardcoded text, ensuring your application is ready for global audiences.

---

## ✨ Features

- ✅ **Extract Translation Keys**: Automatically extracts i18n keys from Angular source files (`.ts`, `.html`).
- 🛠 **Manage Missing Keys**: Adds missing keys to translation JSON files with `"TODO"` values.
- 🧹 **Clean Unused Keys**: Detects and removes unused translation keys from JSON files.
- 🔁 **Handle Duplicates**: Identifies and removes duplicate keys in JSON files.
- 🔍 **Hardcoded Text Detection**: Scans `.html` and `.component.ts` files for hardcoded strings in UI elements and components (e.g., `Swal.fire` properties like `title`, `confirmButtonText`).
- 🌍 **Automatic Text Replacement**: Replaces hardcoded strings with `@ngx-translate/core` translation keys (e.g., `this.translateService.instant('text.key')` in TypeScript, `{{ 'text.key' | translate }}` in HTML).
- 📋 **Detailed Summary**: Provides a clear report of present, new, unused, and duplicate keys, plus hardcoded text findings.

---

## 📋 Prerequisites

- **Node.js**: Version 14 or higher.
- **Angular**: Version 10 or higher (compatible with NgModule-based and standalone components).
- **@ngx-translate/core**: Required for hardcoded text replacement.
- **Translation JSON**: A JSON file (e.g., `src/assets/i18n/en.json`) for storing translation keys and values.

---

## 📦 Installation

1. Install the CLI tool globally:

   ```bash
   npm install -g ngx-i18n-scan
   ```

2. Install `@ngx-translate/core` in your Angular project:

   ```bash
   npm install @ngx-translate/core @ngx-translate/http-loader --save
   ```

3. Configure `@ngx-translate/core` in your Angular application:

   **For Angular &lt; 17 (NgModule-based)**: Update `src/app/app.module.ts`:

   ```typescript
   import { NgModule } from '@angular/core';
   import { BrowserModule } from '@angular/platform-browser';
   import { HttpClientModule, HttpClient } from '@angular/common/http';
   import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
   import { TranslateHttpLoader } from '@ngx-translate/http-loader';
   import { AppComponent } from './app.component';
   
   export function HttpLoaderFactory(http: HttpClient) {
       return new TranslateHttpLoader(http, './assets/i18n/', '.json');
   }
   
   @NgModule({
       declarations: [AppComponent],
       imports: [
           BrowserModule,
           HttpClientModule,
           TranslateModule.forRoot({
               loader: {
                   provide: TranslateLoader,
                   useFactory: HttpLoaderFactory,
                   deps: [HttpClient]
               }
           })
       ],
       bootstrap: [AppComponent]
   })
   export class AppModule {}
   ```

   **For Angular 17+ (Standalone Components)**: Update `src/app/app.config.ts`:

   ```typescript
   import { ApplicationConfig } from '@angular/core';
   import { provideHttpClient } from '@angular/common/http';
   import { TranslateHttpLoader } from '@ngx-translate/http-loader';
   import { provideTranslateService } from '@ngx-translate/core';
   
   export const appConfig: ApplicationConfig = {
       providers: [
           provideHttpClient(),
           provideTranslateService({
               loader: {
                   provide: TranslateHttpLoader,
                   useFactory: (http: HttpClient) => new TranslateHttpLoader(http, './assets/i18n/', '.json'),
                   deps: [HttpClient]
               }
           })
       ]
   };
   ```

   Initialize the default language in `src/app/app.component.ts`:

   ```typescript
   import { Component } from '@angular/core';
   import { TranslateService } from '@ngx-translate/core';
   
   @Component({
       selector: 'app-root',
       standalone: true,
       template: `...`
   })
   export class AppComponent {
       constructor(translate: TranslateService) {
           translate.setDefaultLang('en');
           translate.use('en');
       }
   }
   ```

4. Ensure a translation JSON file exists (e.g., `src/assets/i18n/en.json`):

   ```json
   {}
   ```

---

## 🚀 Usage

Run the CLI with the following command:

```bash
ngx-i18n-scan [options]
```

The tool automatically detects:

- **Source Directory**: Defaults to `./src` in the project root.
- **Translation JSON**: Searches for `i18n` folders and prompts you to select a JSON file if multiple are found.

You can manually specify paths using `--src` and `--json` to override automatic detection.

### Examples

1. **Automatic Detection**:

   ```bash
   ngx-i18n-scan --detect-hardcoded --replace-hardcoded
   ```

**Manual Paths**:

ngx-i18n-scan --src ./src --json ./assets/i18n/en.json --detect-hardcoded --replace-hardcoded

---

## ⚙️ Available Options

| Flag | Description |
| --- | --- |
| `--src <path>` | Path to your Angular source directory (default: `./src`). |
| `--json <path>` | Path to your translation JSON file (e.g., `en.json`). |
| `--add-missing` | Automatically add missing keys to the JSON with `"TODO"` values. |
| `--list-missing` | List missing keys not found in the JSON file. |
| `--remove-unused` | Remove unused translation keys from the JSON file. |
| `--list-unused` | List unused keys found in the JSON file. |
| `--remove-duplicates` | Remove duplicate keys from the JSON file. |
| `--list-duplicates` | List duplicate keys found in the JSON file. |
| `--detect-hardcoded` | Detect hardcoded text in `.html` and `.component.ts` files. |
| `--replace-hardcoded` | Replace hardcoded text with translation keys (requires `--detect-hardcoded`). |

---

## 🧪 Example Commands

### ✅ Detect and Replace Hardcoded Text (Automatic Detection)

Scans for hardcoded strings and replaces them with `@ngx-translate/core` keys:

```bash
ngx-i18n-scan --detect-hardcoded --replace-hardcoded
```

**Output Example**:

```
🔍 Found 4 hardcoded string(s):
1. Employee saved successfully! ➜ text.employee.saved.successfully
2. Okay ➜ text.okay
3. Welcome ➜ text.welcome
4. Enter name ➜ text.enter.name
💾 Updated src/app/pages/employees/add-update-employee/add-update-employee.component.ts
💾 Updated src/app/pages/employees/add-update-employee/add-update-employee.component.html
✅ Hardcoded text replaced and translation JSON updated.
```

**Result**:

- TypeScript: `Swal.fire({ title: 'Employee saved successfully!' })` → `Swal.fire({ title: this.translateService.instant('text.employee.saved.successfully') })`
- HTML: `<h1>Welcome</h1>` → `<h1>{{ 'text.welcome' | translate }}</h1>`
- JSON: Adds keys like `"text.employee.saved.successfully": "Employee saved successfully!"`

### ✅ Detect and Replace with Manual Paths

Same as above but with specified paths:

```bash
ngx-i18n-scan --src ./src --json ./assets/i18n/en.json --detect-hardcoded --replace-hardcoded
```

### 🛠 Add Missing Keys

Extracts keys from source and adds missing ones to JSON:

```bash
ngx-i18n-scan --add-missing
```

### 🧹 Remove Unused Keys

Removes keys from JSON that aren’t used in the source:

```bash
ngx-i18n-scan --remove-unused
```

### 🔁 List and Remove Duplicates

Identifies and removes duplicate keys in JSON:

```bash
ngx-i18n-scan --list-duplicates --remove-duplicates
```

---

## 📂 Output Format

- **Translation JSON**: Uses a flat key structure with dot notation:

  ```json
  {
    "text.employee.saved.successfully": "Employee saved successfully!",
    "text.okay": "Okay",
    "text.welcome": "Welcome"
  }
  ```

- **TypeScript Modifications** (with `--replace-hardcoded`):

  - Adds `TranslateService` import and constructor injection.
  - Replaces hardcoded strings in `Swal.fire` properties (`title`, `message`, `confirmButtonText`, `cancelButtonText`, `html`) with `this.translateService.instant('text.key')`.

- **HTML Modifications** (with `--replace-hardcoded`):

  - Replaces hardcoded text with `{{ 'text.key' | translate }}`.
  - Updates placeholders with `placeholder="{{ 'text.key' | translate }}"`.

---

## 📈 Output Summary

After execution, the CLI provides a detailed report:

```
📊 Summary Report:
- Present keys: 100
- New keys added: 20
- Unused keys: 5
- Duplicate keys: 2
✅ ngx-i18n-scan process completed.
```

For hardcoded text detection:

```
🔍 Found 4 hardcoded string(s):
1. Employee saved successfully! ➜ text.employee.saved.successfully
2. Okay ➜ text.okay
3. Welcome ➜ text.welcome
4. Enter name ➜ text.enter.name
```

---

## 🛠 Troubleshooting

- **No JSON file found**: Ensure `src/assets/i18n/en.json` exists or use `--json <path>` to specify a file.
- **Source directory not found**: Verify `./src` exists or use `--src <path>` to specify a directory.
- **Hardcoded replacements not applied**: Confirm `@ngx-translate/core` is installed and configured.
- **Formatting issues**: The tool preserves original TypeScript formatting; report any issues with file examples.
- **Angular 17+**: For standalone components, ensure `provideTranslateService` is in `app.config.ts`.

---

## 👨‍💻 Author

**Author**: Pratik Sonone

---

## 📄 License

MIT License. See LICENSE for details.