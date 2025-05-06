import { cva } from "class-variance-authority";

// ---------------------------------------–-------------------------------------
// `CodeBlockAction` styles
// ---------------------------------------–-------------------------------------

export const codeBlockActionsVariants = cva(["flex", "items-center", "gap-2"], {
  variants: {
    inHeader: {
      true: ["flex", "ml-2"],
      false: ["absolute", "right-2", "top-2"],
    },
    showOnHover: {
      true: [],
      false: [],
    },
  },
  compoundVariants: [
    {
      inHeader: false,
      showOnHover: true,
      className: ["hidden", "animate-in", "fade-in", "group-hover:flex"],
    },
    { inHeader: false, showOnHover: false, className: ["flex"] },
  ],
});

// ---------------------------------------–-------------------------------------
// `CodeBlock` styles
// ---------------------------------------–-------------------------------------

export const codeBlockContainerVariants = cva(
  ["flex", "flex-col", "overflow-hidden", "border", "border-gray-6", "hide-scrollbar"],
  {
    variants: {
      roundedTop: {
        true: ["rounded-xl"],
        false: ["rounded-b-xl", "rounded-t-none"],
      },
      containerized: {
        true: [],
        false: ["rounded-none", "border-0", "[&_[code-block-pre]]:rounded-none"],
      },
    },
  },
);

export const codeBlockHeaderFileNameContainerStyles = "flex items-center space-x-2 text-gray-11";

export const codeBlockHeaderFileNameIconStyles = "w-4 h-4";

export const codeBlockHeaderFileNameStyles = "text-sm text-ellipsis overflow-hidden line-clamp-1";

export const codeBlockHeaderStyles =
  "flex min-h-10 sticky top-0 z-10 h-10 max-h-10 grow items-center justify-between border-separator-bottom bg-muted/20 backdrop-blur-sm hover:bg-muted/40 pl-4 pr-2 rounded-top-xl";

export const codeBlockLineHighlightedStyles = "bg-blue-4 shadow-[inset_2px_0] shadow-blue-9";

export const codeBlockLineNumberStyles = "h-full mr-4 inline-block min-w-4 w-4 text-end text-gray-11 select-none";

export const codeBlockLineVariants = cva(["px-4", "flex"], {
  variants: {
    breakLines: {
      true: ["break-all", "whitespace-break-spaces"],
      false: ["min-w-fit"],
    },
  },
});

export const codeBlockPreVariants = cva(["group", "py-4", "px-0", "my-0", "bg-gray-3"], {
  variants: {
    hasHeader: {
      // `0.6875rem` is `11px`, which is 1px less than `rounded-xl`, the
      // container's border radius, to ensure the `<pre>` component lines up
      // with the container's border.
      true: ["rounded-b-[0.6875rem]", "rounded-t-none"],
      false: ["rounded-[0.6875rem]"],
    },
    breakLines: {
      true: ["whitespace-pre-line", "overflow-x-auto"],
      false: ["overflow-x-scroll", "hide-scrollbar", "scrollbar-thin"],
    },
  },
});

export const codeBlockStyles =
  "text-xs w-fit min-w-full normal leading-5 flex flex-col [&_[code-block-token]]:min-h-5 [&_[code-block-token]]:min-w-fit";

export const collapseButtonStyles = "flex items-center justify-center cursor-pointer size-7 p-0";
