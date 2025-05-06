import type { VariantProps } from "class-variance-authority";
import type { JSX } from "react";

import { codeBlockActionsVariants, codeBlockContainerVariants } from "./styles.js";

// -----------------------------------------------------------------------------
// Variant props
// -----------------------------------------------------------------------------

type CodeBlockActionsVariantProps = VariantProps<typeof codeBlockActionsVariants>;

type CodeBlockVariantProps = VariantProps<typeof codeBlockContainerVariants>;

// -----------------------------------------------------------------------------
// Component props
// -----------------------------------------------------------------------------

export type CodeBlockActionsProps = CodeBlockActionsVariantProps & {
  code: string;
};

export type CodeBlockLanguage =
  | "javascript"
  | "js"
  | "typescript"
  | "ts"
  | "jsx"
  | "tsx"
  | "solidity"
  | "sol"
  | "python"
  | "py"
  | "bash"
  | "sh"
  | "diff"
  | "none";

export type CodeBlockProps = Omit<JSX.IntrinsicElements["pre"], "children"> &
  CodeBlockVariantProps & {
    fileName?: string;
    language?: CodeBlockLanguage;
    logo?: React.FC<JSX.IntrinsicElements["svg"]>;
    highlightLines?: number[];
    showLineNumbers?: boolean;
    breakLines?: boolean;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    containerProps?: JSX.IntrinsicElements["div"];
    children: string | Object | Array<string | Object>;
  };
