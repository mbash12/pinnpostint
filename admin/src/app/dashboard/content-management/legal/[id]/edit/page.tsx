"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { RichTextEditor } from "@/components/base/rich-text-editor";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import { useLegalDocument, useUpdateLegalDocument } from "@/hooks/use-legal-documents";
import { UpdateLegalDocumentRequest } from "@/lib/api-types";

interface EditLegalDocumentPageProps {
    params: Promise<{
        id: string;
    }>;
}

type LegalDocumentFormState = {
    title: string;
    slug: string;
    content: string;
    isActive: boolean;
};

export default function EditLegalDocumentPage({ params }: EditLegalDocumentPageProps) {
    const router = useRouter();
    const hasSubmitted = useRef(false);
    const [documentId, setDocumentId] = useState<string>("");
    const [formState, setFormState] = useState<LegalDocumentFormState>({
        title: "",
        slug: "",
        content: "",
        isActive: true,
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });
    const [htmlModal, setHtmlModal] = useState({ isOpen: false, html: "" });

    // Handle async params
    React.useEffect(() => {
        params.then((resolvedParams) => {
            setDocumentId(resolvedParams.id);
        });
    }, [params]);

    const { data: document, isLoading } = useLegalDocument(documentId);
    const updateDocumentMutation = useUpdateLegalDocument();

    useEffect(() => {
        if (document) {
            setFormState({
                title: document.title,
                slug: document.slug,
                content: document.content,
                isActive: document.isActive,
            });
        }
    }, [document]);

    const handleChange = (field: keyof typeof formState, value: string | boolean) => {
        setFormState((prev) => ({
            ...prev,
            [field]: value,
        }));
        if (fieldErrors[field]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        // Prevent double submission
        if (hasSubmitted.current) return;

        try {
            hasSubmitted.current = true;

            const documentData: UpdateLegalDocumentRequest = {
                title: formState.title,
                slug: formState.slug,
                content: formState.content,
                isActive: formState.isActive,
            };

            const result = await updateDocumentMutation.mutateAsync({ id: documentId, data: documentData });

            if (result?.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Document Updated",
                    description: "Legal document has been successfully updated.",
                    type: "success",
                });

                setTimeout(() => {
                    router.push("/dashboard/content-management/legal");
                }, 1500);
            } else {
                throw new Error(result?.error?.message || 'Update failed');
            }

        } catch (error: any) {
            hasSubmitted.current = false;
            if (error?.error?.details && Array.isArray(error.error.details)) {
                const errors: Record<string, string> = {};
                error.error.details.forEach((detail: any) => {
                    if (detail.field && detail.message) {
                        errors[detail.field] = detail.message;
                    }
                });
                setFieldErrors(errors);
                setAlertDialog({
                    isOpen: true,
                    title: "Validation Error",
                    description: "Please check the form fields and correct the errors.",
                    type: "error",
                });
            } else {
                setAlertDialog({
                    isOpen: true,
                    title: "Update Failed",
                    description: error?.message || "Failed to update document. Please try again.",
                    type: "error",
                });
            }
        }
    };

    const handleCancel = () => {
        router.back();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-primary">Loading document...</div>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <h2 className="text-lg font-semibold text-primary">Document Not Found</h2>
                <p className="text-tertiary">The document you're looking for doesn't exist.</p>
                <Button color="primary" onClick={handleCancel}>
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">Content management</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Edit Legal Document</h1>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Input
                            label="Title"
                            placeholder="e.g. Privacy Policy"
                            value={formState.title}
                            onChange={(value) => handleChange("title", value)}
                            isRequired
                            isInvalid={!!fieldErrors.title}
                            hint={fieldErrors.title}
                        />
                        <Input
                            label="Slug"
                            placeholder="e.g. privacy-policy"
                            value={formState.slug}
                            onChange={(value) => handleChange("slug", value)}
                            hint="Used in URLs."
                            isRequired
                            isInvalid={!!fieldErrors.slug}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-primary">Content</label>
                            <Button
                                type="button"
                                color="secondary"
                                size="sm"
                                onClick={() => setHtmlModal({ isOpen: true, html: formState.content })}
                            >
                                Paste HTML
                            </Button>
                        </div>
                        <RichTextEditor
                            value={formState.content}
                            onChange={(content) => handleChange("content", content)}
                            placeholder="Write document content here..."
                            className="min-h-[300px]"
                            height="h-96"
                            onAlert={(title, description, type = "info") => {
                                setAlertDialog({
                                    isOpen: true,
                                    title,
                                    description,
                                    type,
                                });
                            }}
                        />
                    </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
                    <header>
                        <h2 className="text-lg font-semibold text-primary">Settings</h2>
                        <p className="text-sm text-tertiary">Configure visibility.</p>
                    </header>

                    <div className="grid gap-3 md:grid-cols-1">
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-secondary bg-secondary p-4">
                            <div>
                                <p className="text-sm font-semibold text-primary">Active</p>
                                <p className="text-xs text-tertiary">Toggle to control if the document is visible to users.</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={formState.isActive}
                                onChange={(event) => handleChange("isActive", event.target.checked)}
                            />
                        </label>
                    </div>
                </section>

                <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                        type="button"
                        color="secondary"
                        size="sm"
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="primary"
                        size="sm"
                        type="submit"
                        isLoading={updateDocumentMutation.isPending}
                        isDisabled={updateDocumentMutation.isPending}
                    >
                        {updateDocumentMutation.isPending ? "Saving..." : "Save changes"}
                    </Button>
                </footer>
            </form>

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />

            {htmlModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-secondary bg-primary p-6 shadow-lg">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-primary">Paste HTML Code</h2>
                            <p className="text-sm text-tertiary">Paste your HTML code below to replace the current content.</p>
                        </div>
                        <textarea
                            value={htmlModal.html}
                            onChange={(e) => setHtmlModal({ ...htmlModal, html: e.target.value })}
                            className="mb-4 h-96 w-full rounded-lg border border-secondary bg-secondary p-4 text-sm font-mono text-primary focus:border-blue-500 focus:outline-none"
                            placeholder="Paste your HTML code here..."
                        />
                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                color="secondary"
                                size="sm"
                                onClick={() => setHtmlModal({ isOpen: false, html: "" })}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                color="primary"
                                size="sm"
                                onClick={() => {
                                    handleChange("content", htmlModal.html);
                                    setHtmlModal({ isOpen: false, html: "" });
                                }}
                            >
                                Apply HTML
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
