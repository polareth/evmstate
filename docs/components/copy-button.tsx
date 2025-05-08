import type { CSSProperties } from "react";

import { cn } from "~/utils.js";

import { Checkmark } from "./icons/checkmark.js";
import { Copy } from "./icons/copy.js";

export const CopyButton = ({
  copy,
  copied,
  className,
  style,
  iconClassName,
}: {
  copy: () => void;
  copied: boolean;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
}) => {
  return (
    <button
      className={cn("vocs_CopyButton", className)}
      data-copied={copied}
      onClick={copy}
      type="button"
      style={style}
    >
      <div
        aria-label={copied ? "Copied" : "Copy"}
        role="img"
        className={cn("vocs_Icon", copied && "vocs_CopyButton_copied")}
      >
        {copied ? (
          <Checkmark className={cn("size-[14px]", iconClassName)} />
        ) : (
          <Copy className={cn("size-[18px]", iconClassName)} />
        )}
      </div>
    </button>
  );
};
