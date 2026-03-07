import fs from "node:fs";
import path from "node:path";
import i18next from "i18next";

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

function collectUsedKeys(filePaths) {
  const used = new Map();
  const keyPattern = /\bt\(\s*["']([^"']+)["']/g;

  for (const filePath of filePaths) {
    const source = fs.readFileSync(filePath, "utf8");
    let match;

    while ((match = keyPattern.exec(source)) !== null) {
      const key = match[1];
      if (!key.includes(".")) continue;

      const normalizedPath = path.relative(ROOT, filePath);
      const locations = used.get(key) ?? [];
      locations.push(normalizedPath);
      used.set(key, locations);
    }
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
