import { Check, ClipboardIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/button.js";

import { codeBlockActionsVariants } from "./styles.js";
import type { CodeBlockActionsProps } from "./types.js";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const CodeBlockActions: React.FC<CodeBlockActionsProps> = ({ code, inHeader }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => setMounted(true), []);

  const isTouchScreen = mounted ? /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) : false;

  const copyToClipboard = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!copied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    navigator.clipboard.writeText(code);
  };

  return (
    <div
      className={codeBlockActionsVariants({
        inHeader: Boolean(inHeader),
        showOnHover: !isTouchScreen,
      })}
    >
      <Button
        className="size-7 cursor-pointer p-0"
        variant="ghost"
        title="Copy to clipboard"
        onClick={copyToClipboard}
        type="button"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="animate-in fade-in zoom-in size-3 duration-300" />
        ) : (
          <ClipboardIcon className="animate-in fade-in size-3 duration-300" />
        )}
      </Button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

CodeBlockActions.displayName = "CodeBlockActions";

export default CodeBlockActions;
