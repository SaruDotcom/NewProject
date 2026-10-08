import * as React from "react";
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const muiVariant: MuiButtonProps["variant"] = variant === "default" || variant === "destructive" ? "contained" : variant === "link" ? "text" : variant;
    const content = asChild && React.isValidElement(children) ? children : null;
    return (
      <MuiButton
        ref={ref}
        className={cn(size === "icon" && "min-w-9 w-9", className)}
        variant={muiVariant}
        color={variant === "destructive" ? "error" : "primary"}
        size={size === "default" || size === "icon" ? "medium" : size}
        component={content ? content.type : "button"}
        {...(content ? content.props : {})}
        {...props}
      >
        {content ? content.props.children : children}
      </MuiButton>
    );
  },
);
Button.displayName = "Button";

export { Button };
