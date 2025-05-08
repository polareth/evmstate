import type { PrismTheme } from "prism-react-renderer";

/** Prism theme based on the light theme colors from theme-light.json. Maps VS Code TextMate scopes to Prism token types. */
export const themeLight: PrismTheme = {
  plain: {},
  styles: [
    {
      types: ["comment", "prolog"],
      style: {
        color: "#999999", // From theme-light.json comment scope
      },
    },
    {
      types: ["constant", "symbol"],
      style: {
        color: "#007ACC", // From theme-light.json constant scope
      },
    },
    {
      types: ["entity", "class-name", "maybe-class-name", "builtin"],
      style: {
        color: "#228B22", // From theme-light.json entity scope
      },
    },
    {
      types: ["tag", "deleted"],
      style: {
        color: "#C62828", // From theme-light.json entity.name.tag scope
      },
    },
    {
      types: ["function"],
      style: {
        color: "#C2185B", // From theme-light.json entity.name.function scope
      },
    },
    {
      types: ["attr-name"],
      style: {
        color: "#FFA000", // From theme-light.json entity.other.attribute-name scope
      },
    },
    {
      types: ["keyword", "storage"],
      style: {
        color: "#007ACC", // From theme-light.json keyword, storage scopes
      },
    },
    {
      types: ["keyword.control-flow"],
      style: {
        color: "#C2185B", // From theme-light.json keyword.control scope
      },
    },
    {
      types: ["operator", "punctuation"],
      style: {
        color: "#444444", // From theme-light.json keyword.operator, punctuation scopes
      },
    },
    {
      types: ["string", "char", "inserted"],
      style: {
        color: "#C62828", // From theme-light.json meta.string, string scopes
      },
    },
    {
      types: ["variable", "parameter"],
      style: {
        color: "#444444", // From theme-light.json variable scopes
      },
    },
    {
      types: ["number", "boolean"],
      style: {
        color: "#00AEEF", // From theme-light.json debugTokenExpression.boolean/number (using a common bright color)
      },
    },
    // Add more mappings as needed based on theme-light.json and Prism token types
    // Example: Adding styles for specific punctuation or operators if needed
    {
      types: ["punctuation.operator"],
      style: {
        color: "#444444", // Explicitly setting operator punctuation color
      },
    },
    {
      types: ["punctuation.definition.string"],
      style: {
        color: "#C62828", // Explicitly setting string punctuation color
      },
    },
    {
      types: ["punctuation.definition.tag"],
      style: {
        color: "#C62828", // Explicitly setting tag punctuation color
      },
    },
    {
      types: ["punctuation.definition.variable"],
      style: {
        color: "#444444", // Explicitly setting variable punctuation color
      },
    },
    {
      types: ["punctuation.definition.function"],
      style: {
        color: "#C2185B", // Explicitly setting function punctuation color
      },
    },
    {
      types: ["punctuation.definition.keyword"],
      style: {
        color: "#007ACC", // Explicitly setting keyword punctuation color
      },
    },
    {
      types: ["punctuation.definition.entity"],
      style: {
        color: "#228B22", // Explicitly setting entity punctuation color
      },
    },
    {
      types: ["punctuation.definition.constant"],
      style: {
        color: "#007ACC", // Explicitly setting constant punctuation color
      },
    },
    {
      types: ["punctuation.definition.number"],
      style: {
        color: "#00AEEF", // Explicitly setting number punctuation color
      },
    },
    {
      types: ["punctuation.definition.boolean"],
      style: {
        color: "#00AEEF", // Explicitly setting boolean punctuation color
      },
    },
    {
      types: ["punctuation.definition.property"],
      style: {
        color: "#444444", // Explicitly setting property punctuation color
      },
    },
    {
      types: ["punctuation.definition.parameter"],
      style: {
        color: "#444444", // Explicitly setting parameter punctuation color
      },
    },
    {
      types: ["punctuation.definition.comment"],
      style: {
        color: "#999999", // Explicitly setting comment punctuation color
      },
    },
    {
      types: ["punctuation.definition.selector"],
      style: {
        color: "#FFA000", // Explicitly setting selector punctuation color
      },
    },
    {
      types: ["punctuation.definition.atrule"],
      style: {
        color: "#FFA000", // Explicitly setting atrule punctuation color
      },
    },
    {
      types: ["punctuation.definition.unit"],
      style: {
        color: "#00AEEF", // Explicitly setting unit punctuation color
      },
    },
    {
      types: ["punctuation.definition.inserted"],
      style: {
        color: "#C62828", // Explicitly setting inserted punctuation color
      },
    },
    {
      types: ["punctuation.definition.deleted"],
      style: {
        color: "#C62828", // Explicitly setting deleted punctuation color
      },
    },
    {
      types: ["punctuation.definition.regex"],
      style: {
        color: "#C62828", // Explicitly setting regex punctuation color
      },
    },
    {
      types: ["punctuation.definition.interpolation"],
      style: {
        color: "#007ACC", // Explicitly setting interpolation punctuation color
      },
    },
    {
      types: ["punctuation.definition.template-expression"],
      style: {
        color: "#007ACC", // Explicitly setting template expression punctuation color
      },
    },
    {
      types: ["punctuation.section.interpolation"],
      style: {
        color: "#007ACC", // Explicitly setting interpolation section punctuation color
      },
    },
    {
      types: ["punctuation.section.template-expression"],
      style: {
        color: "#007ACC", // Explicitly setting template expression section punctuation color
      },
    },
    {
      types: ["punctuation.accessor"],
      style: {
        color: "#444444", // Explicitly setting accessor punctuation color
      },
    },
    {
      types: ["punctuation.separator"],
      style: {
        color: "#444444", // Explicitly setting separator punctuation color
      },
    },
    {
      types: ["punctuation.terminator"],
      style: {
        color: "#444444", // Explicitly setting terminator punctuation color
      },
    },
    {
      types: ["punctuation.validator"],
      style: {
        color: "#444444", // Explicitly setting validator punctuation color
      },
    },
    {
      types: ["punctuation.other"],
      style: {
        color: "#444444", // Explicitly setting other punctuation color
      },
    },
  ],
};

/** Prism theme based on the dark theme colors from poimandres. Maps VS Code TextMate scopes to Prism token types. */
export const themeDark: PrismTheme = {
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
