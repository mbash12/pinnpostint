"use client";

import { useTheme } from "next-themes";
import { Moon02, Sun } from "@untitledui/icons";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex w-full items-center justify-between gap-3 rounded-md p-2">
                <div className="flex gap-2 text-sm font-semibold text-secondary">
                    <div className="size-5 animate-pulse bg-secondary rounded" />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    const isDark = theme === "dark";
    const Icon = isDark ? Sun : Moon02;
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    const displayLabel = isDark ? "Light mode" : "Dark mode";

    const handleToggle = () => {
        setTheme(isDark ? "light" : "dark");
    };

    return (
        <button
            onClick={handleToggle}
            className="group/item w-full cursor-pointer px-1.5 focus:outline-hidden"
            title={label}
        >
            <div className="flex w-full items-center justify-between gap-3 rounded-md p-2 group-hover/item:bg-primary_hover outline-focus-ring group-focus-visible/item:outline-2 group-focus-visible/item:outline-offset-2">
                <div className="flex gap-2 text-sm font-semibold text-secondary group-hover/item:text-secondary_hover">
                    <Icon className="size-5 text-fg-quaternary" />
                    {displayLabel}
                </div>
                <kbd className="flex rounded px-1 py-px font-body text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">
                    {isDark ? "☀️" : "🌙"}
                </kbd>
            </div>
        </button>
    );
}