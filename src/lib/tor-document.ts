import { escapeHtml, isRichTextEmpty, normalizeRichTextValue } from "@/lib/rich-text";

export type TorDocumentSection = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export function buildTorDocumentHtml(
  sections: TorDocumentSection[],
  values: Record<string, string>
): string {
  return sections
    .map((section) => {
      const body = normalizeRichTextValue(values[section.key]) || "<p></p>";

      return [
        `<section data-tor-section="true" data-section-key="${escapeHtml(section.key)}" data-section-label="${escapeHtml(section.label)}" data-section-placeholder="${escapeHtml(section.placeholder || "")}" data-section-required="${section.required ? "true" : "false"}">`,
        `<div data-tor-section-body="true">${body}</div>`,
        "</section>",
      ].join("");
    })
    .join("");
}

export function buildTorDocumentPreviewHtml(
  sections: TorDocumentSection[],
  values: Record<string, string>
): string {
  return sections
    .map((section) => {
      const body = normalizeRichTextValue(values[section.key]) || "<p></p>";

      return [
        `<section class="tor-section-node">`,
        `<div class="tor-section-node__label">${escapeHtml(section.label)}${section.required ? " *" : ""}</div>`,
        `<div class="tor-section-node__body">${body}</div>`,
        "</section>",
      ].join("");
    })
    .join("");
}

export function extractTorDocumentValues(html: string): Record<string, string> {
  if (typeof window === "undefined") return {};

  const doc = new DOMParser().parseFromString(html, "text/html");
  const nextValues: Record<string, string> = {};

  for (const section of doc.querySelectorAll<HTMLElement>("section[data-tor-section='true']")) {
    const key = section.dataset.sectionKey;
    if (!key) continue;

    const body = section.querySelector<HTMLElement>("[data-tor-section-body='true']");
    const value = body?.innerHTML?.trim() || "";
    nextValues[key] = isRichTextEmpty(value) ? "" : value;
  }

  return nextValues;
}
