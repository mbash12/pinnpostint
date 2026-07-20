import { ReactNode } from "react";
import { ToggleField } from "./toggle-field";

interface SettingsSectionProps {
    title: string;
    description: string;
    children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
    return (
        <section className="space-y-4 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
            <header>
                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                <p className="text-sm text-tertiary">{description}</p>
            </header>
            <div className="grid gap-3 md:grid-cols-2">
                {children}
            </div>
        </section>
    );
}
