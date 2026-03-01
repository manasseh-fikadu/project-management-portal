"use client";

import { useEffect } from "react";
import { i18n } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en.json";
import am from "@/lib/i18n/locales/am.json";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function flattenStrings(input: unknown, output: string[]) {
  if (typeof input === "string") {
    output.push(input);
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => flattenStrings(item, output));
    return;
  }

  Object.values(input).forEach((item) => flattenStrings(item, output));
}

function buildTranslationMaps() {
  const enValues: string[] = [];
  const amValues: string[] = [];

  flattenStrings(en, enValues);
  flattenStrings(am, amValues);

  const enToAm = new Map<string, string>();
  const amToEn = new Map<string, string>();
  const max = Math.min(enValues.length, amValues.length);

  for (let i = 0; i < max; i += 1) {
    const source = normalizeText(enValues[i] ?? "");
    const target = amValues[i] ?? "";
    const reverseSource = normalizeText(amValues[i] ?? "");
    const reverseTarget = enValues[i] ?? "";

    if (source && target && source !== normalizeText(target)) {
      enToAm.set(source, target);
    }

    if (reverseSource && reverseTarget && reverseSource !== normalizeText(reverseTarget)) {
      amToEn.set(reverseSource, reverseTarget);
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
  const attributes = ["placeholder", "title", "aria-label", "alt", "value"] as const;
  for (const name of attributes) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const translated = map.get(normalizeText(value));
    if (translated && translated !== value) {
      element.setAttribute(name, translated);
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
  elements.forEach((element) => translateElementAttributes(element, map));
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
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
      attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"],
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

  return children;
}
