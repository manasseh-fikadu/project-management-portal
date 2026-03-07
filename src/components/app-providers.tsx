"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { ensureI18nInitialized, i18n, syncPreferredLanguage } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en.json";
import am from "@/lib/i18n/locales/am.json";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function flattenStrings(input: unknown, output: Map<string, string>, prefix = "") {
  if (typeof input === "string") {
    if (prefix) {
      output.set(prefix, input);
    }
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenStrings(item, output, nextPrefix);
    });
    return;
  }

  Object.entries(input as Record<string, unknown>).forEach(([key, item]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenStrings(item, output, nextPrefix);
  });
}

function buildTranslationMaps() {
  const enValues = new Map<string, string>();
  const amValues = new Map<string, string>();

  flattenStrings(en, enValues);
  flattenStrings(am, amValues);

  const enToAm = new Map<string, string>();
  const amToEn = new Map<string, string>();
  const keys = new Set([...enValues.keys(), ...amValues.keys()]);

  for (const key of keys) {
    const enValue = enValues.get(key);
    const amValue = amValues.get(key);
    if (!enValue || !amValue) continue;

    const source = normalizeText(enValue);
    const target = normalizeText(amValue);

    if (source && target && source !== target) {
      enToAm.set(source, amValue);
      amToEn.set(target, enValue);
    }
  }

  return { enToAm, amToEn };
}

const { enToAm, amToEn } = buildTranslationMaps();

function isSkippableTextNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT";
}

function translateTextNode(node: Node, map: Map<string, string>) {
  const raw = node.nodeValue;
  if (!raw) return;

  const normalized = normalizeText(raw);
  if (!normalized) return;

  const translated = map.get(normalized);
  if (!translated) return;

  const leadingWhitespace = raw.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = raw.match(/\s*$/)?.[0] ?? "";
  const nextValue = `${leadingWhitespace}${translated}${trailingWhitespace}`;

  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue;
  }
}

function translateElementAttributes(element: Element, map: Map<string, string>) {
  const attributes = ["placeholder", "title", "aria-label", "alt"] as const;
  for (const name of attributes) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const translated = map.get(normalizeText(value));
    if (translated && translated !== value) {
      element.setAttribute(name, translated);
    }
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "button" || type === "submit" || type === "reset") {
      const value = element.getAttribute("value");
      if (!value) return;
      const translated = map.get(normalizeText(value));
      if (translated && translated !== value) {
        element.setAttribute("value", translated);
      }
    }
    return;
  }

  if (element instanceof HTMLButtonElement) {
    const text = element.textContent;
    if (!text) return;
    const normalized = normalizeText(text);
    if (!normalized) return;
    const translated = map.get(normalized);
    if (translated && translated !== normalized) {
      element.textContent = translated;
    }
  }
}

function applyGlobalTranslation(root: ParentNode, map: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.nextNode();

  while (current) {
    if (!isSkippableTextNode(current)) {
      translateTextNode(current, map);
    }
    current = walker.nextNode();
  }

  const elements = root.querySelectorAll("*");
  elements.forEach((element) => {
    translateElementAttributes(element, map);
  });
}

export function AppProviders({
  children,
  preferredLanguage,
}: {
  children: React.ReactNode;
  preferredLanguage?: string;
}) {
  ensureI18nInitialized(preferredLanguage);

  useEffect(() => {
    syncPreferredLanguage();

    let scheduled = false;
    let applying = false;

    function currentMap() {
      return i18n.language === "am" ? enToAm : amToEn;
    }

    function runApply() {
      if (applying) return;
      applying = true;
      applyGlobalTranslation(document.body, currentMap());
      applying = false;
    }

    function scheduleApply() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        runApply();
      });
    }

    const observer = new MutationObserver(() => {
      scheduleApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });

    const onLanguageChange = () => {
      scheduleApply();
    };

    i18n.on("languageChanged", onLanguageChange);
    scheduleApply();

    return () => {
      observer.disconnect();
      i18n.off("languageChanged", onLanguageChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
