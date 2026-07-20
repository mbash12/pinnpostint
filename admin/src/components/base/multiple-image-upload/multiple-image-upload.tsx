"use client";

import { useState } from "react";
import { UploadCloud02, X, ImageX as ImageIcon } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { FileUploadResponse } from "@/lib/api-client";
import { Modal, ModalOverlay, Dialog, DialogTrigger } from "@/components/application/modals/modal";

interface MultipleImageUploadProps {
    value?: string[];
    onChange?: (urls: string[]) => void;
    onFilesUploaded?: (files: FileUploadResponse[]) => void;
    className?: string;
    label?: string;
    hint?: string;
    isRequired?: boolean;
    isInvalid?: boolean;
    maxSize?: number; // in bytes
    maxFiles?: number;
}

export function MultipleImageUpload({
    value = [],
    onChange,
    onFilesUploaded,
    className,
    label = "Upload Images",
    hint = "Upload multiple images (recommended: 1200x630px each)",
    isRequired = false,
    isInvalid = false,
    maxSize = 5 * 1024 * 1024, // 5MB
    maxFiles = 10,
}: MultipleImageUploadProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const {
        uploadMultipleImages,
        isUploading,
        progress: uploadProgress,
        error,
        validateFile,
        formatFileSize
    } = useFileUpload({
        maxSize,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        onSuccess: (response) => {
            if ('files' in response) {
                const urls = response.files.map(file => file.url);
                onChange?.([...value, ...urls]);
                onFilesUploaded?.(response.files);
            }
        },
        onError: (error) => {
            // Upload error: error
        }
    });

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);

        // Check if adding these files would exceed the limit
        if (value.length + fileArray.length > maxFiles) {
            return; // Let the FileUpload component handle the error
        }

        // Use the hook's upload function
        await uploadMultipleImages(fileArray);
    };

    const handleRemoveImage = (index: number) => {
        const newUrls = value.filter((_, i) => i !== index);
        onChange?.(newUrls);
    };

    const remainingSlots = maxFiles - value.length;

    return (
        <div className={`space-y-4 ${className}`}>
            {label && (
                <label className="text-sm font-semibold text-primary">
                    {label}
                    {isRequired && <span className="text-error-primary ml-1">*</span>}
                </label>
            )}

            {/* Uploaded Images Grid */}
            {value.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {value.map((url, index) => (
                        <div key={index} className="relative group aspect-video bg-secondary/30 rounded-lg border border-secondary flex items-center justify-center overflow-hidden">
                            <img
                                src={url}
                                alt={`Upload ${index + 1}`}
                                onClick={() => setPreviewUrl(url)}
                                className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            />
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveImage(index);
                                }}
                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm opacity-0 transition-all hover:bg-error-50 hover:text-error-600 group-hover:opacity-100 z-10"
                                title="Remove Image"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            {index === 0 && (
                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                    Cover
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Area */}
            {remainingSlots > 0 && (
                <FileUpload.DropZone
                    accept="image/*"
                    allowsMultiple={true}
                    maxSize={maxSize}
                    onDropFiles={handleFileSelect}
                    onDropUnacceptedFiles={() => { }}
                    onSizeLimitExceed={() => { }}
                    className={`${isInvalid ? 'ring-2 ring-error-primary' : ''}`}
                    hint={`${hint} (${remainingSlots} more allowed)`}
                />
            )}

            {error && (
                <p className="text-xs text-error-primary">{error}</p>
            )}

            {isUploading && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-tertiary">Uploading images...</span>
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

            {/* Upload Info */}
            <div className="text-xs text-tertiary space-y-1">
                <p>
                    {value.length} of {maxFiles} images uploaded
                </p>
                <p>
                    Max file size: {formatFileSize(maxSize)} per image
                </p>
                <p>
                    Supported formats: JPEG, PNG, GIF, WebP, SVG
                </p>
            </div>

            <DialogTrigger isOpen={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
                <ModalOverlay>
                    <Modal>
                        <Dialog className="mx-auto w-full max-w-4xl bg-transparent border-none shadow-none flex items-center justify-center p-4">
                            <div className="relative w-full flex justify-center">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setPreviewUrl(null);
                                    }}
                                    className="absolute md:-right-12 -right-4 -top-12 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 z-50"
                                    title="Close Preview"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                {previewUrl && (
                                    <img
                                        src={previewUrl}
                                        alt="Full Preview"
                                        className="h-auto max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
                                    />
                                )}
                            </div>
                        </Dialog>
                    </Modal>
                </ModalOverlay>
            </DialogTrigger>
        </div>
    );
}