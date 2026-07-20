import { ChangeEvent } from "react";

interface FileInputProps {
    label: string;
    accept?: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    hint?: string;
    isInvalid?: boolean;
    disabled?: boolean;
}

export function FileInput({
    label,
    accept = "image/*",
    onChange,
    hint,
    isInvalid = false,
    disabled = false,
}: FileInputProps) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-primary">{label}</label>
            <input
                type="file"
                accept={accept}
                onChange={onChange}
                disabled={disabled}
                className={`block w-full cursor-pointer rounded-lg border bg-secondary px-4 py-2 text-sm text-primary shadow-xs focus:outline-hidden ${
                    isInvalid
                        ? "border-red-500 focus:border-red-500"
                        : "border-secondary focus:border-brand"
                }`}
            />
            {hint && (
                <p className={`text-xs ${isInvalid ? "text-red-500" : "text-tertiary"}`}>
                    {hint}
                </p>
            )}
        </div>
    );
}
