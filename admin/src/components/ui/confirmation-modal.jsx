import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmationModal({
    open,
    title = 'Confirm action',
    description = 'This action cannot be undone.',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
}) {
    return _jsx(Dialog, {
        open,
        onOpenChange: (nextOpen) => {
            if (!nextOpen && onCancel) onCancel();
        },
        children: _jsxs(DialogContent, {
            children: [
                _jsxs(DialogHeader, {
                    children: [
                        _jsx(DialogTitle, { children: title }),
                        _jsx(DialogDescription, { children: description }),
                    ],
                }),
                _jsxs(DialogFooter, {
                    children: [
                        _jsx(Button, {
                            variant: "outline",
                            onClick: onCancel,
                            children: cancelLabel,
                        }),
                        _jsx(Button, {
                            variant,
                            onClick: onConfirm,
                            children: confirmLabel,
                        }),
                    ],
                }),
            ],
        }),
    });
}
