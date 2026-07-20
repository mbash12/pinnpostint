import { Button } from "@/components/base/buttons/button";

interface FormActionsProps {
    cancelHref: string;
    submitLabel?: string;
    isLoading?: boolean;
    isDisabled?: boolean;
    onCancel?: () => void;
    metadata?: {
        createdAt?: string;
        updatedAt?: string;
    };
}

export function FormActions({
    cancelHref,
    submitLabel = "Save",
    isLoading = false,
    isDisabled = false,
    onCancel,
    metadata,
}: FormActionsProps) {
    return (
        <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {metadata && (
                <div className="text-xs text-tertiary">
                    {metadata.createdAt && <p>Created: {new Date(metadata.createdAt).toLocaleDateString()}</p>}
                    {metadata.updatedAt && <p>Last updated: {new Date(metadata.updatedAt).toLocaleDateString()}</p>}
                </div>
            )}
            <div className={`flex flex-col-reverse gap-3 sm:flex-row ${!metadata ? 'sm:ml-auto' : ''}`}>
                <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    href={onCancel ? undefined : cancelHref}
                    onClick={onCancel}
                    isDisabled={isDisabled}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    color="primary"
                    size="sm"
                    isLoading={isLoading}
                    isDisabled={isDisabled}
                >
                    {isLoading ? "Saving..." : submitLabel}
                </Button>
            </div>
        </footer>
    );
}
