"use client";

import React, { useState, KeyboardEvent } from "react";
import { cx } from "@/utils/cx";

interface NumberArrayInputProps {
    value: number[];
    onChange: (value: number[]) => void;
    placeholder?: string;
    label?: string;
    hint?: string;
    disabled?: boolean;
}

export const NumberArrayInput = ({
    value,
    onChange,
    placeholder = "Type a number and press Enter",
    label,
    hint,
    disabled = false,
}: NumberArrayInputProps) => {
    const [inputValue, setInputValue] = useState("");

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && inputValue.trim()) {
            e.preventDefault();
            const num = parseInt(inputValue.trim(), 10);
            if (!isNaN(num) && num > 0 && !value.includes(num)) {
                onChange([...value, num].sort((a, b) => b - a));
            }
            setInputValue("");
        } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
            onChange(value.slice(0, -1));
        } else if (e.key === ",") {
            e.preventDefault();
            const num = parseInt(inputValue.trim(), 10);
            if (!isNaN(num) && num > 0 && !value.includes(num)) {
                onChange([...value, num].sort((a, b) => b - a));
            }
            setInputValue("");
        }
    };

    const removeItem = (num: number) => {
        onChange(value.filter((v) => v !== num));
    };

    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-sm font-medium text-primary">
                    {label}
                </label>
            )}
            <div
                className={cx(
                    "flex flex-wrap gap-2 rounded-lg border border-secondary bg-primary p-2 min-h-[42px]",
                    disabled && "cursor-not-allowed bg-disabled_subtle opacity-60"
                )}
            >
                {value.map((num) => (
                    <span
                        key={num}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-subtle px-3 py-1 text-sm font-medium text-brand"
                    >
                        {num} day{num > 1 ? "s" : ""}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => removeItem(num)}
                                className="text-tertiary hover:text-error-primary text-base leading-none"
                            >
                                ×
                            </button>
                        )}
                    </span>
                ))}
                {!disabled && (
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={value.length === 0 ? placeholder : ""}
                        className="flex-1 min-w-[120px] bg-transparent text-sm text-primary placeholder:text-placeholder outline-none"
                    />
                )}
            </div>
            {hint && <p className="text-xs text-tertiary">{hint}</p>}
        </div>
    );
};
