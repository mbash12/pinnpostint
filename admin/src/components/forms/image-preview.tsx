import { Avatar } from "@/components/base/avatar/avatar";

interface ImagePreviewProps {
    src?: string;
    alt: string;
    fileName?: string;
}

export function ImagePreview({ src, alt, fileName }: ImagePreviewProps) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <Avatar size="md" src={src} alt={alt} />
            <div>
                <p className="text-xs text-tertiary">Preview</p>
                <p className="text-sm font-medium text-primary">
                    {fileName || "No image selected"}
                </p>
            </div>
        </div>
    );
}
