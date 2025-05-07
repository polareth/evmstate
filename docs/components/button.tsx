import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "~/utils.js";

// Button props interface
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost";
  asChild?: boolean;
}

/** Button component with various style variants */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    return <button className={cn("btn", variant === "ghost" && "btn-ghost", className)} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button };
