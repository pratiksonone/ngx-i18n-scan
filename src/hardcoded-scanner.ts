import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Helper function to check if a string is a translation key
function isTranslationKey(text: string): boolean {
    return text.startsWith('text.') || /^[A-Z_]+$/.test(text);
}

// Helper function to check if a node is part of a translation function or pipe
function isPartOfTranslation(node: ts.Node, sourceFile: ts.SourceFile): boolean {
    let current: ts.Node | undefined = node;
    while (current && current !== sourceFile) {
        if (ts.isCallExpression(current)) {
            const expression = current.expression;
            if (
                ts.isPropertyAccessExpression(expression) &&
                (expression.name.text === 'get' || expression.name.text === 'instant') &&
                expression.expression.getText(sourceFile).includes('translate')
            ) {
                return true;
            }
        } else if (
            ts.isBinaryExpression(current) &&
            current.operatorToken.kind === ts.SyntaxKind.BarToken &&
            current.right.getText(sourceFile).includes('translate')
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

// Helper function to check if a node is in a non-translatable context
function isNonTranslatableContext(node: ts.Node): boolean {
    let current: ts.Node | undefined = node;
    while (current) {
        if (
            ts.isEnumDeclaration(current) ||
            ts.isInterfaceDeclaration(current) ||
            ts.isTypeAliasDeclaration(current) ||
            (ts.isRegularExpressionLiteral(current) && current !== node) ||
            (ts.isDecorator(current) && !current.getText().includes('@Component')) ||
            ts.isImportDeclaration(current) ||
            ts.isImportSpecifier(current)
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

// Helper function to check if a string is in a UI-related context for specific properties
function isUIContext(node: ts.Node, sourceFile: ts.SourceFile, targetProperties: string[]): boolean {
    let current: ts.Node | undefined = node;
    while (current && current !== sourceFile) {
        if (ts.isPropertyAssignment(current)) {
            const propertyName = current.name.getText(sourceFile);
            if (
                targetProperties.includes(propertyName) &&
                current.parent &&
                ts.isObjectLiteralExpression(current.parent) &&
                current.parent.parent &&
                ts.isCallExpression(current.parent.parent)
            ) {
                const callExpression = current.parent.parent as ts.CallExpression;
                const expressionText = callExpression.expression.getText(sourceFile);
                if (['Swal.fire', 'alert', 'confirm', 'MatSnackBar.open'].some(method => expressionText.includes(method))) {
                    return true;
                }
            }
        }
        current = current.parent;
    }
    return false;
}

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

export function detectHardcodedTextInTS(directory: string): { file: string, line: number, text: string }[] {
    const results: { file: string, line: number, text: string }[] = [];
    const targetProperties = ['message', 'title', 'confirmButtonText', 'cancelButtonText'];

    function scanFile(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        function visit(node: ts.Node) {
            if (
                (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
                node.text.trim()
            ) {
                const text = node.text.trim();
                // Check for targeted properties
                if (
                    text.length >= 3 &&
                    !isTranslationKey(text) &&
                    !isPartOfTranslation(node, sourceFile) &&
                    !isNonTranslatableContext(node) &&
                    isUIContext(node, sourceFile, targetProperties)
                ) {
                    const {line} = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                    results.push({file: filePath, line: line + 1, text});
                }
                // Check for HTML content in 'html' property
                if (
                    node.parent &&
                    ts.isPropertyAssignment(node.parent) &&
                    node.parent.name.getText(sourceFile) === 'html' &&
                    node.parent.parent &&
                    ts.isObjectLiteralExpression(node.parent.parent) &&
                    node.parent.parent.parent &&
                    ts.isCallExpression(node.parent.parent.parent) &&
                    ['Swal.fire', 'alert', 'confirm', 'MatSnackBar.open'].includes(node.parent.parent.parent.expression.getText(sourceFile))
                ) {
                    // Treat the string as HTML content
                    const htmlContent = text;
                    const baseLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
                    const htmlLines = htmlContent.split('\n');
                    const tempFilePath = filePath; // Use original file path for reporting
                    htmlLines.forEach((lineText, index) => {
                        const regex = /(?:(?:>|^|\s)([A-Za-z\s]+?)(?=<|\s*{{|\s*$))|(?:(?:placeholder=")([^"]+?)(?="))|(?:(?:\[\w+\]="[^"]*?\?\s*['"]([^'"]+?)['"]\s*:\s*['"]([^'"]+?)['"][^"]*?"))|(?:(?:\?\s*['"]([^'"]+?)(?=['"])))|(?:(?::\s*['"]([^'"]+?)(?=['"])))/g;
                        let match;
                        while ((match = regex.exec(lineText)) !== null) {
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
                            for (const htmlText of texts) {
                                if (
                                    htmlText.length >= 3 &&
                                    !isTranslationKey(htmlText) &&
                                    !lineText.includes(`'${htmlText}' | translate`) &&
                                    !lineText.includes(`"${htmlText}" | translate`) &&
                                    !isNaN(Number(htmlText)) === false
                                ) {
                                    results.push({file: tempFilePath, line: baseLine + index + 1, text: htmlText});
                                }
                            }
                        }
                    });
                    // Also capture the entire HTML content as a single translatable unit
                    if (htmlContent.trim().length >= 3 && !isTranslationKey(htmlContent)) {
                        results.push({file: tempFilePath, line: baseLine + 1, text: htmlContent});
                    }
                }
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
    }

    function walkDir(currentPath: string) {
        const entries = fs.readdirSync(currentPath, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (fullPath.endsWith('.component.ts')) {
                scanFile(fullPath);
            }
        }
    }

    walkDir(directory);
    return results;
}

export function replaceHardcodedTextInTS(filePath: string, replacements: { [key: string]: string }) {
    const content = fs.readFileSync(filePath, 'utf8');
    let sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
    );

    const targetProperties = ['message', 'title', 'confirmButtonText', 'cancelButtonText'];

    // Check if TranslateService is already imported
    let hasTranslateServiceImport = false;
    sourceFile.statements.forEach(statement => {
        if (
            ts.isImportDeclaration(statement) &&
            statement.moduleSpecifier.getText(sourceFile).includes('@ngx-translate/core') &&
            statement.importClause?.namedBindings &&
            ts.isNamedImports(statement.importClause.namedBindings) &&
            statement.importClause.namedBindings.elements.some(spec => spec.name.text === 'TranslateService')
        ) {
            hasTranslateServiceImport = true;
        }
    });

    // Add TranslateService import if not present
    let updatedStatements = [...sourceFile.statements];
    if (!hasTranslateServiceImport) {
        const importDeclaration = ts.factory.createImportDeclaration(
            undefined,
            ts.factory.createImportClause(
                false,
                undefined,
                ts.factory.createNamedImports([
                    ts.factory.createImportSpecifier(
                        false,
                        undefined,
                        ts.factory.createIdentifier('TranslateService')
                    )
                ])
            ),
            ts.factory.createStringLiteral('@ngx-translate/core'),
            undefined
        );
        updatedStatements = [importDeclaration, ...sourceFile.statements];
    }

    // Find the class declaration and add TranslateService to constructor
    let classDeclaration: ts.ClassDeclaration | undefined;
    let hasTranslateServiceInjection = false;
    sourceFile.statements.forEach(statement => {
        if (ts.isClassDeclaration(statement)) {
            classDeclaration = statement;
            statement.members.forEach(member => {
                if (ts.isConstructorDeclaration(member)) {
                    member.parameters.forEach(param => {
                        if (param.name.getText(sourceFile) === 'translateService') {
                            hasTranslateServiceInjection = true;
                        }
                    });
                }
            });
        }
    });

    if (classDeclaration && !hasTranslateServiceInjection) {
        const updatedMembers = [...classDeclaration.members];
        let constructorIndex = -1;
        classDeclaration.members.forEach((member, index) => {
            if (ts.isConstructorDeclaration(member)) {
                constructorIndex = index;
            }
        });

        if (constructorIndex !== -1) {
            // Update existing constructor
            const existingConstructor = classDeclaration.members[constructorIndex] as ts.ConstructorDeclaration;
            const updatedParameters = [
                ...existingConstructor.parameters,
                ts.factory.createParameterDeclaration(
                    [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword)],
                    undefined,
                    ts.factory.createIdentifier('translateService'),
                    undefined,
                    ts.factory.createTypeReferenceNode('TranslateService', undefined),
                    undefined
                )
            ];
            updatedMembers[constructorIndex] = ts.factory.updateConstructorDeclaration(
                existingConstructor,
                existingConstructor.modifiers,
                updatedParameters,
                existingConstructor.body
            );
        } else {
            // Add new constructor
            const newConstructor = ts.factory.createConstructorDeclaration(
                undefined,
                [
                    ts.factory.createParameterDeclaration(
                        [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword)],
                        undefined,
                        ts.factory.createIdentifier('translateService'),
                        undefined,
                        ts.factory.createTypeReferenceNode('TranslateService', undefined),
                        undefined
                    )
                ],
                ts.factory.createBlock([], true)
            );
            updatedMembers.push(newConstructor);
        }

        classDeclaration = ts.factory.updateClassDeclaration(
            classDeclaration,
            classDeclaration.modifiers,
            classDeclaration.name,
            classDeclaration.typeParameters,
            classDeclaration.heritageClauses,
            updatedMembers
        );

        updatedStatements = updatedStatements.map(statement =>
            ts.isClassDeclaration(statement) ? classDeclaration! : statement
        );
    }

    // Update source file with new statements
    sourceFile = ts.factory.updateSourceFile(sourceFile, updatedStatements);

    const transformer = <T extends ts.Node>(context: ts.TransformationContext) => {
        return (rootNode: T) => {
            function visit(node: ts.Node): ts.Node {
                if (
                    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
                    node.text.trim()
                ) {
                    const text = node.text.trim();
                    if (
                        replacements[text] &&
                        !isTranslationKey(text) &&
                        !isPartOfTranslation(node, sourceFile) &&
                        !isNonTranslatableContext(node) &&
                        (isUIContext(node, sourceFile, targetProperties) ||
                            (node.parent &&
                                ts.isPropertyAssignment(node.parent) &&
                                node.parent.name.getText(sourceFile) === 'html' &&
                                node.parent.parent &&
                                ts.isObjectLiteralExpression(node.parent.parent) &&
                                node.parent.parent.parent &&
                                ts.isCallExpression(node.parent.parent.parent) &&
                                ['Swal.fire', 'alert', 'confirm', 'MatSnackBar.open'].includes(node.parent.parent.parent.expression.getText(sourceFile))))
                    ) {
                        return ts.factory.createCallExpression(
                            ts.factory.createPropertyAccessExpression(
                                ts.factory.createPropertyAccessExpression(
                                    ts.factory.createThis(),
                                    ts.factory.createIdentifier('translateService')
                                ),
                                ts.factory.createIdentifier('instant')
                            ),
                            undefined,
                            [ts.factory.createStringLiteral(replacements[text])]
                        );
                    }
                }
                return ts.visitEachChild(node, visit, context);
            }

            return ts.visitNode(rootNode, visit) as T;
        };
    };

    const result = ts.transform(sourceFile, [transformer]);
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;

    const printer = ts.createPrinter({newLine: ts.NewLineKind.LineFeed});
    const newContent = printer.printFile(transformedSourceFile);

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Wrote updated content to ${filePath}`);
    } else {
        console.log(`No changes made to ${filePath}`);
    }
}