"use client";

import { ThemeProvider } from "next-themes";
import { config } from "@/config/environment";

export function Theme({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider 
            attribute="class" 
            value={{ light: "light-mode", dark: "dark-mode" }} 
            enableSystem
            defaultTheme={config.theme.defaultTheme}
            storageKey={config.theme.storageKey}
        >
            {children}
        </ThemeProvider>
    );
}
