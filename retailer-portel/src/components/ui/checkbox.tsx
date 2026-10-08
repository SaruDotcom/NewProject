import * as React from "react";
import MuiCheckbox, { type CheckboxProps } from "@mui/material/Checkbox";

export interface CustomCheckboxProps extends CheckboxProps {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CustomCheckboxProps>(({ onCheckedChange, onChange, ...props }, ref) => (
  <MuiCheckbox
    ref={ref}
    size="small"
    onChange={(e, checked) => {
      onChange?.(e, checked);
      onCheckedChange?.(checked);
    }}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";

export { Checkbox };

