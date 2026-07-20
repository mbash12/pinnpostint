import { ReactNode } from "react";

interface FormSectionProps {
    title?: string;
    description?: string;
    children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
    return (
        <section className="space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-sm">
            {(title || description) && (
                <header className="space-y-1">
                    {title && <h2 className="text-lg font-semibold text-primary">{title}</h2>}
                    {description && <p className="text-sm text-tertiary">{description}</p>}
                </header>
            )}
            {children}
        </section>
    );
}
