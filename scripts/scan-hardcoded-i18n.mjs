import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const ALLOWED_PATTERNS = [
  /^MoTRI$/,
  /^MoTRI - Project Management Portal$/,
  /^MoTRI Logo$/,
  /^MoTRI Project Portal$/,
  /^Donor Project Monitoring$/,
  /^Donor Portal - MoTRI Project Management$/,
  /^Read-only project monitoring portal for donors$/,
  /^Ministry of Trade and Regional Integration$/,
  /^Ministry of Trade and Regional Integration - Project Management Portal(?:\. This is a read-only view\. For questions, contact the project administrator\.)?$/,
  /^ETB$/,
  /^USD$/,
  /^EUR$/,
  /^Q[1-4]$/,
  /^(?:GET|POST|PUT|PATCH|DELETE)$/,
  /^Content-Type$/,
  /^Content-Disposition$/,
  /^Backspace$/,
  /^(?:NO)?SCRIPT$/,
  /^STYLE$/,
  /^AGRA_WRF_BUDGET_DETAIL$/,
  /^Error .+:$/,
  /^Failed to .+:$/,
  /^Failed to .+$/,
  /^[A-Z]{2,10}-\d{2,}.*$/,
];

function walkFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnore(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (normalized.length < 3) return true;
  if (normalized.includes("{") || normalized.includes("}")) return true;
  if (
    normalized.includes("=>") ||
    normalized.includes("===") ||
    normalized.includes("&&") ||
    normalized.includes("||") ||
    normalized.includes(".map(") ||
    normalized.includes(".filter(") ||
    normalized.includes(".reduce(") ||
    normalized.includes(".some(") ||
    normalized.includes(".trim())") ||
    normalized.includes(".length > 0 ? (") ||
    normalized.includes(").length > 0 ? (") ||
    normalized.includes("return (") ||
    normalized.includes("const ")
  ) {
    return true;
  }
  if (ALLOWED_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  return false;
}

function collectMatches(source, filePath) {
  const matches = [];
  const patterns = [
    { type: "jsx-text", regex: />\s*([A-Za-z][^<{]{2,})\s*</g },
    { type: "attr", regex: /\b(?:placeholder|title|aria-label|alt)=["']([^"']*[A-Za-z][^"']{2,})["']/g },
    { type: "string", regex: /["'`]([A-Z][^"'`\n]{2,})["'`]/g },
  ];

  for (const { type, regex } of patterns) {
    let match;
    while ((match = regex.exec(source)) !== null) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (shouldIgnore(text)) continue;

      const line = source.slice(0, match.index).split("\n").length;
      matches.push({
        filePath,
        line,
        type,
        text,
      });
    }
  }

  return matches;
}

const files = walkFiles(SRC_DIR);
const findings = files.flatMap((filePath) => collectMatches(fs.readFileSync(filePath, "utf8"), path.relative(ROOT, filePath)));

if (findings.length === 0) {
  console.log("No obvious hardcoded UI strings found");
  process.exit(0);
}

console.log("Possible hardcoded UI strings:");
for (const finding of findings) {
  console.log(`${finding.filePath}:${finding.line} [${finding.type}] ${finding.text}`);
}

process.exit(1);
