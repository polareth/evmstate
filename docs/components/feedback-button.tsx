import { Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "~/utils.js";

import { Button, type ButtonProps } from "./button.js";
import { Checkmark } from "./icons/checkmark.js";

interface FeedbackButtonProps extends ButtonProps {
  action: () => void | Promise<void>;
  actionLabel: string;
  timeout?: number;
}

export const FeedbackButton = ({ action, actionLabel, timeout = 1000, ...props }: FeedbackButtonProps) => {
  const [acting, setActing] = useState(false);
  const [acted, setActed] = useState(false);

  const handleClick = async () => {
    const result = action();
    if (result instanceof Promise) {
      setActing(true);
      await result;
      setActing(false);
    }

    setActed(true);
    setTimeout(() => {
      setActed(false);
    }, timeout);
  };

  return (
    <Button onClick={handleClick} className={cn(props.className, "relative")} {...props}>
      {acted && (
        <Checkmark
          className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[14px]", !acted && "hidden")}
        />
      )}
      {acting && (
        <Loader2
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-4 animate-spin",
            !acting && "hidden",
          )}
        />
      )}
      <span className={cn("transition-opacity duration-100 opacity-75", (acting || acted) && "opacity-0")}>
        {actionLabel}
      </span>
    </Button>
  );
};
