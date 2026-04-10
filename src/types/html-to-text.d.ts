declare module "html-to-text" {
  export type HtmlToTextOptions = {
    wordwrap?: number | false;
    [key: string]: unknown;
  };

  export function convert(html: string, options?: HtmlToTextOptions): string;
}
