import { cn } from "~/utils.js";

import { Checkmark } from "./icons/checkmark.js";
import { Copy } from "./icons/copy.js";

export const CopyButton = ({ copy, copied }: { copy: () => void; copied: boolean }) => {
  return (
    <button className="vocs_CopyButton" data-copied={copied} onClick={copy} type="button">
      <div
        aria-label={copied ? "Copied" : "Copy"}
        role="img"
        className={cn("vocs_Icon", copied && "vocs_CopyButton_copied")}
      >
        {copied ? <Checkmark className="size-[14px]" /> : <Copy className="size-[18px]" />}
      </div>
    </button>
  );
};
