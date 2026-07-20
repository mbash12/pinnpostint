"use client";

import { Button } from "@/components/base/buttons/button";
import { Dialog, Modal, ModalOverlay } from "./modal";

interface AlertDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    type?: "success" | "error" | "warning" | "info";
    confirmLabel?: string;
}

export function AlertDialog({
    isOpen,
    onClose,
    title,
    description,
    type = "info",
    confirmLabel = "OK",
}: AlertDialogProps) {
    const iconColors = {
        success: "text-success-primary",
        error: "text-error-primary",
        warning: "text-warning-primary",
        info: "text-brand-primary",
    };

    const icons = {
        success: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        ),
        error: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        ),
        warning: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        info: (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal>
                <Dialog className="w-full max-w-md mx-auto">
                    <div className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-xl">
                        <div className="flex gap-4">
                            <div className={`flex-shrink-0 ${iconColors[type]}`}>
                                {icons[type]}
                            </div>
                            <div className="flex-1 space-y-2">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <p className="text-sm text-tertiary">{description}</p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                color="primary"
                                size="sm"
                                onClick={onClose}
                            >
                                {confirmLabel}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
