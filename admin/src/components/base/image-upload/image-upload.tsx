"use client";

import { useState, useRef } from "react";
import { UploadCloud02, X } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";
import { cx } from "@/utils/cx";

interface ImageUploadProps {
    value?: string;
    onChange?: (url: string) => void;
    onRemove?: () => void;
    className?: string;
    label?: string;
    hint?: string;
    isRequired?: boolean;
    isInvalid?: boolean;
    maxSize?: number; // in bytes
}

export function ImageUpload({
    value,
    onChange,
    onRemove,
    className,
    label = "Featured Image",
    hint = "Upload a high-quality image for your article (recommended: 1200x630px)",
    isRequired = false,
    isInvalid = false,
    maxSize = 10 * 1024 * 1024, // 10MB
}: ImageUploadProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const {
        uploadImage,
        isUploading,
        progress: uploadProgress,
        error,
        validateFile,
        formatFileSize
    } = useFileUpload({
        maxSize,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        onProgress: (progress) => {
            // Progress is handled by the hook
        },
        onSuccess: (response) => {
            // Handle both single and multiple file upload responses
            if ('url' in response) {
                onChange?.(response.url);
            } else if ('files' in response && response.files.length > 0) {
                onChange?.(response.files[0].url);
            }
        },
        onError: (error) => {
            // Upload error: error
        }
    });

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];

        // Use the hook's upload function
        await uploadImage(file);
    };

    const handleRemove = () => {
        onRemove?.();
        onChange?.('');
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="text-sm font-semibold text-primary">
                    {label}
                    {isRequired && <span className="text-error-primary ml-1">*</span>}
                </label>
            )}

            {value ? (
                // Image preview with remove option
                <div className="relative group">
                    <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="w-full aspect-video p-0 rounded-lg border border-secondary cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex items-center justify-center bg-secondary/30"
                        aria-label="Open image preview"
                    >
                        <img
                            src={value}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain"
                        />
                    </button>
                    <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove();
                        }}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm opacity-0 hover:bg-error-50 hover:text-error-600 group-hover:opacity-100 z-10"
                        aria-label="Remove Image"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <DialogTrigger isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <ModalOverlay>
                            <Modal>
                                <Dialog className="mx-auto w-full max-w-4xl bg-transparent border-none shadow-none flex items-center justify-center p-4">
                                    <div className="relative w-full flex justify-center">
                                        <button
                                            type="button"
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                setIsPreviewOpen(false);
                                            }}
                                            className="absolute md:-right-12 -right-4 -top-12 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 z-50"
                                            aria-label="Close Preview"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                        <img
                                            src={value}
                                            alt="Full Preview"
                                            className="h-auto max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
                                        />
                                    </div>
                                </Dialog>
                            </Modal>
                        </ModalOverlay>
                    </DialogTrigger>
                </div>
            ) : (
                // Upload area
                <FileUpload.DropZone
                    accept="image/*"
                    allowsMultiple={false}
                    maxSize={maxSize}
                    onDropFiles={handleFileSelect}
                    onDropUnacceptedFiles={() => { }}
                    onSizeLimitExceed={() => { }}
                    className={cx(
                        "w-full aspect-video flex-col justify-center",
                        isInvalid ? 'ring-2 ring-error-primary' : ''
                    )}
                    hint={hint}
                />
            )}

            {error && (
                <p className="text-xs text-error-primary">{error}</p>
            )}

            {isUploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-tertiary">Uploading image...</span>
                        <span className="text-primary">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {hint && !value && !error && (
                <p className="text-xs text-tertiary">{hint}</p>
            )}
        </div>
    );
}