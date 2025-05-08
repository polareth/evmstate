import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import type { ShikiTransformer, ThemeRegistrationAny } from "shiki";

import { CollapseButton } from "~/components/collapse-button.js";
import { CopyButton } from "~/components/copy-button.js";
import { useCopyCode } from "~/components/hooks/use-copy-code.js";
import themeLight from "~/themes/theme-light.json" with { type: "json" };
import { cn, stringify } from "~/utils.js";

interface CodeBlockProps {
  children: string | ReactNode;
  highlighter?: Highlighter;
  className?: string;
  fileName?: string;
  caption?: string | ReactNode;
  language?: string;
  collapsible?: boolean;
}

// Define the type for the imperative handle
export interface CodeBlockRef {
  collapse: () => void;
  expand: () => void;
  isCollapsed: () => boolean;
}

// Enhanced BigInt transformer that removes quotes and properly formats BigInts
const bigIntTransformer: ShikiTransformer = {
  code(root) {
    // Access children of the root element
    if (!root.children) return root;

    /**
     * Recursively processes an array of Shiki nodes to transform BigInt placeholders and remove surrounding quotes.
     *
     * @param nodes The array of nodes to process.
     * @returns A new array of nodes after transformation.
     */
    const transformNodes = (nodes: typeof root.children): typeof root.children => {
      const newNodes: typeof root.children = [];
      let skipNext = false;

      for (let i = 0; i < nodes.length; i++) {
        if (skipNext) {
          skipNext = false;
          continue;
        }

        const node = nodes[i];
        let currentNode = { ...node }; // Create a copy to avoid modifying original nodes directly before deciding to keep them

        // Recursively process children if they exist
        if (currentNode.type === "element" && currentNode.children) {
          currentNode.children = transformNodes(currentNode.children);
        }

        // Check if the current node is a BigInt placeholder
        const isBigIntPlaceholder =
          currentNode.type === "element" &&
          currentNode.children?.[0]?.type === "text" &&
          currentNode.children[0].value.includes("__bigint__");

        if (isBigIntPlaceholder) {
          // Remove the surrounding quotes and transform the value
          const placeholderValue = "value" in currentNode.children![0] ? currentNode.children![0].value : ""; // We know it exists and matches the pattern
          // const bigintMatch = placeholderValue.match(/^"__bigint__(\d+)"$/);
          const bigintMatch = placeholderValue.split("__bigint__")[1];
          if (bigintMatch) {
            // Create a new text node with the transformed BigInt value (e.g., 123n)
            // We might want to preserve the original class names from the element node
            const transformedTextNode = {
              type: "text" as const, // Explicitly type as 'text'
              value: ` ${bigintMatch}n`,
            };
            // Create a new element node with the original classes but the new text child
            const transformedElementNode = {
              ...currentNode, // Copy existing properties like tagName, properties
              children: [transformedTextNode],
            };
            // Remove the previous node and skip the next one
            newNodes.splice(i - 1, 1, transformedElementNode);
            skipNext = true;
          } else {
            // Should not happen if regex matches, but as a fallback, push original node
            newNodes.push(currentNode);
          }
        } else {
          // If not a BigInt placeholder, just add the node (after processing its children)
          newNodes.push(currentNode);
        }
      }
      return newNodes;
    };

    // Start the recursive transformation from the root's children
    root.children = transformNodes(root.children);

    return root;
  },
};

const longHexTransformer: ShikiTransformer = {
  // Simply if we catch a __long_hex__0xabcabc...abcabc we replace it with a 0xabcabc<truncated>abcabc
  span(span) {
    if (
      span.type === "element" &&
      span.children?.[0]?.type === "text" &&
      span.children[0].value.includes("__long_hex__")
    ) {
      const value = span.children[0].value;
      span.children[0].value = value
        .replace("__long_hex__", "")
        .replace("...", "<truncated_see_console_for_full_diff>");
    }
    return span;
  },
};

/** Renders a JavaScript object with syntax highlighting using Shiki. */
export const CodeBlock = forwardRef<CodeBlockRef, CodeBlockProps>(
  (
    { children, highlighter: _highlighter, className, fileName, caption, language = "typescript", collapsible = false },
    ref,
  ) => {
    // State to hold the highlighter instance
    const [highlighter, setHighlighter] = useState<Highlighter | undefined>(_highlighter);
    // State to hold the highlighted HTML string
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

    const { copied, copy, ref: copyRef } = useCopyCode();
    const codeString = useMemo(() => (typeof children === "string" ? children : stringify(children)), [children]);

    const [collapsed, setCollapsed] = useState(false);
    const toggleCollapsed = () => collapsible && setCollapsed(!collapsed);

    // Expose methods via the ref
    useImperativeHandle(ref, () => ({
      /** Imperatively collapses the code block. */
      collapse: () => setCollapsed(true),
      /** Imperatively expands the code block. */
      expand: () => setCollapsed(false),
      /** Returns whether the code block is currently collapsed. */
      isCollapsed: () => collapsed,
    }));

    useEffect(() => {
      const initHighlighter = async () => {
        if (_highlighter) return;
        const highlighter = await createHighlighter({
          themes: ["poimandres", themeLight as ThemeRegistrationAny],
          langs: [language],
        });

        setHighlighter(highlighter);
      };

      initHighlighter();
    }, [_highlighter]);

    // Effect to perform async highlighting when code changes
    useEffect(() => {
      // Async function to perform highlighting
      const highlightCode = async () => {
        try {
          if (!highlighter) return;
          // Use Shiki to highlight the stringified code to HTML
          const html = highlighter.codeToHtml(codeString, {
            lang: language,
            themes: {
              light: themeLight as ThemeRegistrationAny,
              dark: "poimandres",
            },
            transformers: [bigIntTransformer, longHexTransformer],
          });
          setHighlightedHtml(html);
        } catch (error) {
          console.error("Error highlighting code:", error);
          // Optionally set an error state or fallback content
          setHighlightedHtml(
            `<pre>Error highlighting code: ${error instanceof Error ? error.message : JSON.stringify(error)}</pre>`,
          );
        }
      };

      highlightCode();

      // Cleanup function if needed (though not strictly necessary here)
      // return () => { /* cleanup */ };
    }, [children, highlighter]); // Re-run effect if code or theme changes

    // Render loading state or null if not yet highlighted
    if (!highlightedHtml) {
      return (
        <div className={cn("vocs_CodeBlock", className)}>
          <div className="vocs_Pre_wrapper">
            <pre className={cn(className, "vocs_Pre")}>
              <code className="vocs_Code">Loading...</code>
            </pre>
          </div>
        </div>
      );
    }

    return (
      // Wrapped in vocs_ code classes for consistent styling with other code blocks
      <div
        className="vocs_CodeGroup vocs_Tabs"
        style={{ borderBottom: "0", borderBottomLeftRadius: "0", borderBottomRightRadius: "0" }}
      >
        {!!fileName && (
          <div className="vocs_Tabs_list flex items-center gap-x-2 justify-between cursor-pointer">
            <div className="vocs_Tabs_trigger">
              {fileName} {!!caption && <div>{caption}</div>}
            </div>
            {collapsible && <CollapseButton toggle={toggleCollapsed} collapsed={collapsed} className="mr-[0.25rem]" />}
          </div>
        )}
        <div
          className={cn(
            "vocs_CodeBlock",
            collapsible && collapsed
              ? "max-h-0 opacity-0 duration-200 ease-out"
              : "max-h-[5000px] opacity-100 duration-300 ease-in",
            className,
          )}
        >
          <div ref={copyRef} className="vocs_Pre_wrapper">
            <CopyButton copy={copy} copied={copied} />
            <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          </div>
        </div>
      </div>
    );
  },
);
