import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "~/utils.js";

export const CollapseButton = ({
  toggle,
  collapsed,
  className,
}: {
  toggle: () => void;
  collapsed: boolean;
  className?: string;
}) => {
  return (
    <button
      className={cn("vocs_CopyButton !min-w-6 !h-6 !w-6 sm:!h-8 sm:!w-8", className)}
      style={{ opacity: 1, position: "initial" }}
      data-collapsed={collapsed}
      onClick={toggle}
      type="button"
    >
      <div aria-label={collapsed ? "Expand code" : "Collapse code"} role="img" className={cn("vocs_Icon")}>
        {collapsed ? <ChevronDown className="size-3 sm:size-4" /> : <ChevronUp className="size-3 sm:size-4" />}
      </div>
    </button>
  );
};
