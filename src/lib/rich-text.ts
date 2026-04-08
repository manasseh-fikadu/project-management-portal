export function hasRichTextMarkup(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToRichTextHtml(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) return "";

  return value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function normalizeRichTextValue(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) return "";
  return hasRichTextMarkup(value) ? value : plainTextToRichTextHtml(value);
}

export function stripRichTextMarkup(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) return "";

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isRichTextEmpty(value: string | null | undefined): boolean {
  return stripRichTextMarkup(value).length === 0;
}
