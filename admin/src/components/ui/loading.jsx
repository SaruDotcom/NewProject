import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Inbox } from "lucide-react";

export function LoadingSpinner({ label = 'Loading...', className = '' }) {
    return _jsxs("div", {
        className: `flex items-center justify-center gap-2 text-sm text-muted-foreground ${className}`,
        children: [
            _jsx("span", {
                className: "h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent",
            }),
            _jsx("span", { children: label }),
        ],
    });
}

export function LoadingSkeleton({ rows = 4, className = '' }) {
    return _jsxs("div", {
        className: `space-y-3 ${className}`,
        children: Array.from({ length: rows }, (_, index) =>
            _jsxs("div", {
                className: "flex items-center gap-3",
                children: [
                    _jsx(Skeleton, { className: "h-10 w-10 rounded-md" }),
                    _jsxs("div", {
                        className: "flex-1 space-y-2", children: [
                            _jsx(Skeleton, { className: "h-4 w-1/3" }),
                            _jsx(Skeleton, { className: "h-3 w-2/3" }),
                        ]
                    }),
                ],
            }, index)
        ),
    });
}

export function EmptyState({ title = 'No records found', description, actionLabel, onAction }) {
    return _jsxs("div", {
        className: "flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center",
        children: [
            _jsx(Inbox, { className: "mb-3 size-8 text-muted-foreground" }),
            _jsx("h3", { className: "text-base font-semibold text-foreground", children: title }),
            description && _jsx("p", { className: "mt-2 max-w-md text-sm text-muted-foreground", children: description }),
            actionLabel && _jsx(Button, {
                variant: "outline",
                className: "mt-4",
                onClick: onAction,
                children: actionLabel,
            }),
        ],
    });
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
    return _jsxs("div", {
        className: "flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center",
        children: [
            _jsx("div", { className: "mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive", children: "!" }),
            _jsx("h3", { className: "text-base font-semibold text-foreground", children: title }),
            message && _jsx("p", { className: "mt-2 max-w-md text-sm text-muted-foreground", children: message }),
            onRetry && _jsx(Button, {
                variant: "outline",
                className: "mt-4",
                onClick: onRetry,
                children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(RefreshCw, { className: "size-4" }), "Retry"] }),
            }),
        ],
    });
}
