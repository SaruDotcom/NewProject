import * as React from "react";
import MuiChip from "@mui/material/Chip";

export interface BadgeProps extends Omit<React.ComponentProps<typeof MuiChip>, "variant"> {
  variant?: "default" | "secondary" | "destructive" | "outline";
  children?: React.ReactNode;
}

function Badge({ className, variant = "default", children, label, ...props }: BadgeProps) {
  return (
    <MuiChip
      size="small"
      className={className}
      color={variant === "destructive" ? "error" : variant === "default" ? "primary" : "default"}
      variant={variant === "outline" ? "outlined" : "filled"}
      label={label ?? children}
      {...props}
    />
  );
}

export { Badge };
