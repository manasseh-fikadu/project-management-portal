import fs from "node:fs";
import path from "node:path";
import i18next from "i18next";
import ts from "typescript";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const LOCALES_DIR = path.join(ROOT, "src", "lib", "i18n", "locales");
const LOCALES = ["en", "am"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenObject(value, prefix = "") {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
      return flattenObject(nested, nextPrefix);
    }
    return [nextPrefix];
  });
}

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function createEmptyResolvedValue() {
  return {
    strings: new Set(),
    objects: [],
  };
}

function mergeResolvedValues(...values) {
  const merged = createEmptyResolvedValue();

  for (const value of values) {
    if (!value) continue;
    for (const text of value.strings) {
      merged.strings.add(text);
    }
    merged.objects.push(...value.objects);
  }

  return merged;
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name)) {
    const expression = name.expression;
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) {
      return expression.text;
    }
  }

  return null;
}

function resolveSymbolValue(symbol, checker, seenNodes) {
  if (!symbol) return null;

  let target = symbol;
  if (symbol.flags & ts.SymbolFlags.Alias) {
    target = checker.getAliasedSymbol(symbol);
  }

  for (const declaration of target.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return resolveExpressionValue(declaration.initializer, checker, seenNodes);
    }

    if (ts.isBindingElement(declaration)) {
      const propertyName = declaration.propertyName
        ? getPropertyName(declaration.propertyName)
        : declaration.name && ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : null;

      if (!propertyName) continue;

      const parent = declaration.parent;
      const variableDeclaration = parent.parent;
      if (!ts.isVariableDeclaration(variableDeclaration) || !variableDeclaration.initializer) {
        continue;
      }

      const sourceValue = resolveExpressionValue(variableDeclaration.initializer, checker, seenNodes);
      return getPropertyValue(sourceValue, propertyName);
    }

    if (ts.isPropertyAssignment(declaration)) {
      return resolveExpressionValue(declaration.initializer, checker, seenNodes);
    }

    if (ts.isShorthandPropertyAssignment(declaration)) {
      const shorthandSymbol = checker.getShorthandAssignmentValueSymbol(declaration);
      if (shorthandSymbol) {
        return resolveSymbolValue(shorthandSymbol, checker, seenNodes);
      }
    }

    if (ts.isImportSpecifier(declaration) || ts.isImportClause(declaration) || ts.isNamespaceImport(declaration)) {
      return resolveSymbolValue(target, checker, seenNodes);
    }
  }

  return null;
}

function getPropertyValue(resolved, propertyName) {
  if (!resolved) return null;

  const values = [];

  for (const objectValue of resolved.objects) {
    const direct = objectValue.get(propertyName);
    if (direct) {
      values.push(direct);
      continue;
    }
  }

  return values.length > 0 ? mergeResolvedValues(...values) : null;
}

function getAnyPropertyValue(resolved) {
  if (!resolved) return null;

  const values = [];
  for (const objectValue of resolved.objects) {
    for (const propertyValue of objectValue.values()) {
      values.push(propertyValue);
    }
  }

  return values.length > 0 ? mergeResolvedValues(...values) : null;
}

function resolveExpressionValue(expression, checker, seenNodes = new Set()) {
  if (!expression) return null;

  if (seenNodes.has(expression)) {
    return null;
  }

  seenNodes.add(expression);

  if (ts.isStringLiteralLike(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    const resolved = createEmptyResolvedValue();
    resolved.strings.add(expression.text);
    return resolved;
  }

  if (ts.isTemplateExpression(expression)) {
    if (expression.templateSpans.length === 0) {
      const resolved = createEmptyResolvedValue();
      resolved.strings.add(expression.head.text);
      return resolved;
    }
    return null;
  }

  if (ts.isParenthesizedExpression(expression) || ts.isNonNullExpression(expression)) {
    return resolveExpressionValue(expression.expression, checker, seenNodes);
  }

  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return resolveExpressionValue(expression.expression, checker, seenNodes);
  }

  if (ts.isIdentifier(expression)) {
    return resolveSymbolValue(checker.getSymbolAtLocation(expression), checker, seenNodes);
  }

  if (ts.isObjectLiteralExpression(expression)) {
    const properties = new Map();

    for (const property of expression.properties) {
      if (ts.isPropertyAssignment(property)) {
        const propertyName = getPropertyName(property.name);
        if (!propertyName) continue;
        const propertyValue = resolveExpressionValue(property.initializer, checker, seenNodes);
        if (propertyValue) {
          properties.set(propertyName, propertyValue);
        }
        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        const propertyValue = resolveSymbolValue(
          checker.getShorthandAssignmentValueSymbol(property),
          checker,
          seenNodes
        );
        if (propertyValue) {
          properties.set(property.name.text, propertyValue);
        }
        continue;
      }

      if (ts.isSpreadAssignment(property)) {
        const spreadValue = resolveExpressionValue(property.expression, checker, seenNodes);
        for (const objectValue of spreadValue?.objects ?? []) {
          for (const [key, value] of objectValue.entries()) {
            properties.set(key, value);
          }
        }
      }
    }

    const resolved = createEmptyResolvedValue();
    resolved.objects.push(properties);
    return resolved;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const sourceValue = resolveExpressionValue(expression.expression, checker, seenNodes);
    return getPropertyValue(sourceValue, expression.name.text);
  }

  if (ts.isElementAccessExpression(expression)) {
    const sourceValue = resolveExpressionValue(expression.expression, checker, seenNodes);
    if (!sourceValue) return null;

    if (!expression.argumentExpression) {
      return getAnyPropertyValue(sourceValue);
    }

    const keyValue = resolveExpressionValue(expression.argumentExpression, checker, seenNodes);
    if (keyValue?.strings.size) {
      const values = [...keyValue.strings].map((key) => getPropertyValue(sourceValue, key)).filter(Boolean);
      return values.length > 0 ? mergeResolvedValues(...values) : null;
    }

    return getAnyPropertyValue(sourceValue);
  }

  if (ts.isConditionalExpression(expression)) {
    return mergeResolvedValues(
      resolveExpressionValue(expression.whenTrue, checker, seenNodes),
      resolveExpressionValue(expression.whenFalse, checker, seenNodes)
    );
  }

  if (ts.isBinaryExpression(expression)) {
    if (
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return mergeResolvedValues(
        resolveExpressionValue(expression.left, checker, seenNodes),
        resolveExpressionValue(expression.right, checker, seenNodes)
      );
    }
  }

  if (ts.isArrayLiteralExpression(expression)) {
    const properties = new Map();
    expression.elements.forEach((element, index) => {
      const elementValue = resolveExpressionValue(element, checker, seenNodes);
      if (elementValue) {
        properties.set(String(index), elementValue);
      }
    });
    const resolved = createEmptyResolvedValue();
    resolved.objects.push(properties);
    return resolved;
  }

  return null;
}

function collectUsedKeys(filePaths) {
  const used = new Map();
  const normalizedFilePaths = new Set(filePaths.map((filePath) => path.resolve(filePath)));
  const program = ts.createProgram(filePaths, {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
  });
  const checker = program.getTypeChecker();

  function recordKey(filePath, key) {
    if (!key.includes(".")) return;

    const normalizedPath = path.relative(ROOT, filePath);
    const locations = used.get(key) ?? [];
    locations.push(normalizedPath);
    used.set(key, locations);
  }

  function visitNode(node, filePath) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments.length > 0
    ) {
      const resolved = resolveExpressionValue(node.arguments[0], checker);
      for (const key of resolved?.strings ?? []) {
        recordKey(filePath, key);
      }
    }

    ts.forEachChild(node, (child) => visitNode(child, filePath));
  }

  for (const sourceFile of program.getSourceFiles()) {
    const absolutePath = path.resolve(sourceFile.fileName);
    if (!normalizedFilePaths.has(absolutePath)) continue;
    if (sourceFile.isDeclarationFile) continue;
    visitNode(sourceFile, absolutePath);
  }

  return used;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const localeData = Object.fromEntries(
  LOCALES.map((locale) => [locale, readJson(path.join(LOCALES_DIR, `${locale}.json`))])
);

const flattenedLocaleKeys = Object.fromEntries(
  Object.entries(localeData).map(([locale, data]) => [locale, new Set(flattenObject(data))])
);

const referenceLocale = "en";
const referenceKeys = flattenedLocaleKeys[referenceLocale];
const parityIssues = [];

const i18n = i18next.createInstance();
await i18n.init({
  lng: referenceLocale,
  fallbackLng: referenceLocale,
  resources: Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      {
        translation: localeData[locale],
      },
    ])
  ),
  interpolation: {
    escapeValue: false,
  },
});

const sourceFiles = walkFiles(SRC_DIR);
const usedKeys = collectUsedKeys(sourceFiles);

for (const locale of LOCALES) {
  if (locale === referenceLocale) continue;

  const localeKeys = flattenedLocaleKeys[locale];
  const missing = uniqueSorted([...referenceKeys].filter((key) => !localeKeys.has(key)));
  const extra = uniqueSorted([...localeKeys].filter((key) => !referenceKeys.has(key)));

  if (missing.length || extra.length) {
    parityIssues.push({ locale, missing, extra });
  }
}

const missingUsage = [];
const unresolvedUsage = [];

for (const [key, locations] of usedKeys.entries()) {
  const missingIn = LOCALES.filter((locale) => !flattenedLocaleKeys[locale].has(key));
  if (missingIn.length) {
    missingUsage.push({
      key,
      missingIn,
      locations: uniqueSorted(locations),
    });
  }

  const unresolvedIn = LOCALES.filter((locale) => i18n.getFixedT(locale)(key) === key);
  if (unresolvedIn.length) {
    unresolvedUsage.push({
      key,
      unresolvedIn,
      locations: uniqueSorted(locations),
    });
  }
}

if (parityIssues.length === 0 && missingUsage.length === 0 && unresolvedUsage.length === 0) {
  console.log("i18n validation passed");
  process.exit(0);
}

for (const issue of parityIssues) {
  console.error(`Locale parity issue: ${issue.locale}`);
  if (issue.missing.length) {
    console.error(`  Missing keys (${issue.missing.length}):`);
    for (const key of issue.missing) console.error(`    - ${key}`);
  }
  if (issue.extra.length) {
    console.error(`  Extra keys (${issue.extra.length}):`);
    for (const key of issue.extra) console.error(`    - ${key}`);
  }
}

if (missingUsage.length) {
  console.error("Missing keys used in source:");
  for (const issue of missingUsage) {
    console.error(`  ${issue.key} -> missing in ${issue.missingIn.join(", ")}`);
    for (const location of issue.locations) {
      console.error(`    - ${location}`);
    }
  }
}

if (unresolvedUsage.length) {
  console.error("Unresolved keys at runtime:");
  for (const issue of unresolvedUsage) {
    console.error(`  ${issue.key} -> unresolved in ${issue.unresolvedIn.join(", ")}`);
    for (const location of issue.locations) {
      console.error(`    - ${location}`);
    }
  }
}

process.exit(1);
