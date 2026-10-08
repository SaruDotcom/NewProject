import { toast as sonnerToast } from "sonner";

export const toast = {
    success: (message, options) => sonnerToast.success(message, options),
    error: (message, options) => sonnerToast.error(message, options),
    info: (message, options) => sonnerToast.info(message, options),
    warning: (message, options) => sonnerToast.warning(message, options),
    dismiss: sonnerToast.dismiss,
};

export default toast;
