import type { PrismTheme } from "prism-react-renderer";

export const theme: PrismTheme = {
  plain: {},
  styles: [
    {
      types: ["doctype doctype-tag"],
      style: { color: "oklch(0.6 0.15 264)" },
    },
    {
      types: ["doctype name"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["comment", "prolog"],
      style: { color: "oklch(0.708 0 0)" },
    },
    {
      types: ["punctuation"],
      languages: ["html", "css", "javascript"],
      style: { color: "oklch(0.85 0 0)" },
    },
    {
      types: ["property", "tag", "boolean", "number", "constant", "symbol", "inserted", "unit"],
      style: { color: "oklch(0.65 0.15 290)" },
    },
    {
      types: ["selector", "attr-name", "string", "char", "deleted"],
      style: { color: "oklch(0.7 0.12 180)" },
    },
    {
      types: ["string.url"],
      languages: ["css"],
      style: { textDecorationLine: "underline" },
    },
    {
      types: ["operator", "entity"],
      style: { color: "oklch(0.85 0 0)" },
    },
    {
      types: ["operator.arrow"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["atrule"],
      style: { color: "oklch(0.7 0.12 180)" },
    },
    {
      types: ["atrule rule"],
      style: { color: "oklch(0.6 0.15 264)" },
    },
    {
      types: ["atrule url"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["atrule url function"],
      style: { color: "oklch(0.65 0.15 290)" },
    },
    {
      types: ["atrule url punctuation"],
      style: { color: "oklch(0.85 0 0)" },
    },
    {
      types: ["keyword"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["keyword.module", "keyword.control-flow"],
      style: { color: "oklch(0.6 0.15 264)" },
    },
    {
      types: ["function", "function maybe-class-name"],
      style: { color: "oklch(0.65 0.15 290)" },
    },
    {
      types: ["regex"],
      style: { color: "oklch(0.65 0.15 25)" },
    },
    {
      types: ["important"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["constant"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["class-name", "maybe-class-name", "builtin"],
      style: { color: "oklch(0.65 0.12 265)" },
    },
    {
      types: ["console"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["parameter"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["interpolation"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["punctuation.interpolation-punctuation"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["boolean"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["property", "variable", "imports maybe-class-name", "exports maybe-class-name"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["selector"],
      style: { color: "oklch(0.65 0.15 25)" },
    },
    {
      types: ["escape"],
      style: { color: "oklch(0.65 0.15 25)" },
    },
    {
      types: ["tag"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["tag punctuation"],
      style: { color: "oklch(0.708 0 0)" },
    },
    {
      types: ["cdata"],
      style: { color: "oklch(0.708 0 0)" },
    },
    {
      types: ["attr-name"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["attr-value", "attr-value punctuation"],
      style: { color: "oklch(0.7 0.12 180)" },
    },
    {
      types: ["attr-value punctuation.attr-equals"],
      style: { color: "oklch(0.85 0 0)" },
    },
    {
      types: ["entity"],
      style: { color: "oklch(0.7 0.12 265)" },
    },
    {
      types: ["namespace"],
      style: { color: "oklch(0.65 0.12 265)" },
    },
  ],
};
