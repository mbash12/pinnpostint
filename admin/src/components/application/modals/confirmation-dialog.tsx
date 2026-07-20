"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "./modal";

interface ConfirmationDialogProps {
    children: ReactNode;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export function ConfirmationDialog({
    children,
    title,
    description,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm();
        setIsOpen(false);
    };

    const handleCancel = () => {
        onCancel?.();
        setIsOpen(false);
    };

    return (
        <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
            {children}
            <ModalOverlay>
                <Modal>
                    <Dialog className="w-full max-w-md  mx-auto">
                        <div className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-xl">
                            <div className="space-y-3">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <p className="text-sm text-tertiary">{description}</p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={handleCancel}
                                >
                                    {cancelLabel}
                                </Button>
                                <Button
                                    color="primary-destructive"
                                    size="sm"
                                    onClick={handleConfirm}
                                >
                                    {confirmLabel}
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </DialogTrigger>
    );
}
