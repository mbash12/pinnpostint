"use client";

import React, { useRef, ReactNode, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { SearchLg, Settings01, Plus, X, User01, BookOpen01, UploadCloud02 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { apiClient } from "@/lib/api-client";
import { cx } from "@/utils/cx";

interface RichTextEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
    className?: string;
    editorClassName?: string;
    isCharacterCountVisible?: boolean;
    isToolbarVisible?: boolean;
    height?: string;
    onAlert?: (title: string, description: string, type?: "success" | "error" | "warning" | "info") => void;
}

export function RichTextEditor({
    value = "",
    onChange,
    placeholder = "Start typing...",
    maxLength,
    className,
    editorClassName,
    isCharacterCountVisible = true,
    isToolbarVisible = true,
    height = "h-64",
    onAlert,
}: RichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
            CharacterCount.configure({
                limit: maxLength,
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange?.(html);
        },
        immediatelyRender: false,
    });

    // Sync editor content when external value changes
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    if (!editor) {
        return null;
    }

    const setLink = () => {
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        }
    };

    const unsetLink = () => {
        editor.chain().focus().unsetLink().run();
    };

    const addImage = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            onAlert?.('Invalid File Type', 'Please select an image file', 'error');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            onAlert?.('File Too Large', 'File size must be less than 5MB', 'error');
            return;
        }

        try {
            // Upload image using the API client
            const response = await apiClient.uploadFile<{ url: string }>('/upload/image', file, 'image');

            if (response.success && response.data?.url) {
                // Insert the uploaded image into the editor
                editor.chain().focus().setImage({ src: response.data.url }).run();
            } else {
                throw new Error(response.error?.message || 'Upload failed');
            }
        } catch (err: any) {
            onAlert?.('Upload Failed', err.message || 'Failed to upload image', 'error');
            // Upload error: err
        }

        // Clear the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const ToolbarButton = ({ 
        label, 
        onClick, 
        isActive = false,
        title,
        disabled = false
    }: { 
        label: string | ReactNode; 
        onClick: () => void; 
        isActive?: boolean;
        title?: string;
        disabled?: boolean;
    }) => (
        <Button
            size="sm"
            color={isActive ? "primary" : "secondary"}
            onClick={onClick}
            className="min-w-12 px-2 text-xs"
            title={title}
            disabled={disabled}
        >
            {label}
        </Button>
    );

    const characterCount = editor.storage.characterCount.characters();
    const wordCount = editor.storage.characterCount.words();

    return (
        <div className={cx("w-full", className)}>
            {isToolbarVisible && (
                <div className="flex items-center gap-1 p-2 border border-secondary rounded-t-lg bg-secondary flex-wrap">
                    <ToolbarButton
                        label="↶"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo"
                    />
                    <ToolbarButton
                        label="↷"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo"
                    />
                    
                    <div className="w-px h-6 bg-border mx-1" />
                    
                    <ToolbarButton
                        label="B"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive("bold")}
                        title="Bold"
                    />
                    <ToolbarButton
                        label="I"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive("italic")}
                        title="Italic"
                    />
                    
                    <div className="w-px h-6 bg-border mx-1" />
                    
                    <ToolbarButton
                        label="•"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive("bulletList")}
                        title="Bullet List"
                    />
                    <ToolbarButton
                        label="1."
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive("orderedList")}
                        title="Numbered List"
                    />
                    <ToolbarButton
                        label="❞"
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive("blockquote")}
                        title="Quote"
                    />
                    
                    <div className="w-px h-6 bg-border mx-1" />
                    
                    <ToolbarButton
                        label="🔗"
                        onClick={editor.isActive("link") ? unsetLink : setLink}
                        isActive={editor.isActive("link")}
                        title={editor.isActive("link") ? "Remove Link" : "Add Link"}
                    />
                    <ToolbarButton
                        label={<UploadCloud02 className="size-4" />}
                        onClick={addImage}
                        title="Upload Image"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                    />
                </div>
            )}
            
            <div className={cx(
                "border border-secondary rounded-b-lg bg-primary overflow-hidden",
                !isToolbarVisible && "rounded-lg",
                editorClassName
            )}>
                <EditorContent 
                    editor={editor} 
                    className={cx(
                        "prose prose-sm max-w-none focus:outline-none",
                        height,
                        "[&_.ProseMirror]:focus:outline-none",
                        "[&_.ProseMirror]:min-h-[150px]",
                        "[&_.ProseMirror]:h-full",
                        "[&_.ProseMirror]:overflow-y-auto"
                    )} 
                />
            </div>
            
            {isCharacterCountVisible && (
                <div className="flex items-center justify-between px-3 py-2 text-xs text-tertiary border border-secondary border-t-0 rounded-b-lg bg-secondary">
                    <div className="flex items-center gap-4">
                        <span>{wordCount} words</span>
                        <span>{characterCount}{maxLength ? ` / ${maxLength}` : ""} characters</span>
                    </div>
                    {maxLength && (
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div 
                                    className={cx(
                                        "h-full transition-all duration-200",
                                        characterCount > maxLength * 0.9 ? "bg-error" : "bg-brand"
                                    )}
                                    style={{ 
                                        width: `${Math.min((characterCount / maxLength) * 100, 100)}%` 
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Add custom styles for Tiptap editor
export const richTextEditorStyles = `
    /* Basic editor styles */
    .ProseMirror {
        outline: none;
        padding: 1rem;
        line-height: 1.6;
        overflow-y: auto;
        scroll-behavior: smooth;
    }

    .ProseMirror p {
        margin: 0.5rem 0;
    }

    .ProseMirror p:first-child {
        margin-top: 0;
    }

    .ProseMirror p:last-child {
        margin-bottom: 0;
    }

    .ProseMirror h1,
    .ProseMirror h2,
    .ProseMirror h3 {
        margin: 1rem 0 0.5rem;
        font-weight: 600;
        line-height: 1.2;
    }

    .ProseMirror h1 {
        font-size: 1.875rem;
    }

    .ProseMirror h2 {
        font-size: 1.5rem;
    }

    .ProseMirror h3 {
        font-size: 1.25rem;
    }

    .ProseMirror ul,
    .ProseMirror ol {
        padding-left: 1.5rem;
        margin: 0.5rem 0;
    }

    .ProseMirror li {
        margin: 0.25rem 0;
    }

    .ProseMirror blockquote {
        border-left: 4px solid currentColor;
        padding-left: 1rem;
        margin: 1rem 0;
        font-style: italic;
        opacity: 0.8;
    }

    .ProseMirror a {
        color: #3b82f6;
        text-decoration: underline;
    }

    .ProseMirror a:hover {
        color: #2563eb;
    }

    .ProseMirror img {
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
        margin: 1rem 0;
    }

    .ProseMirror:focus {
        outline: none;
    }

    .ProseMirror p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: #9ca3af;
        pointer-events: none;
        height: 0;
    }
`;