import * as React from "react";
import TextField from "@mui/material/TextField";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <TextField inputRef={ref} type={type} className={className} size="small" fullWidth {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
