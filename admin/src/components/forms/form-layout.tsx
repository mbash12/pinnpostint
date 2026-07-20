import { ReactNode } from "react";

interface FormLayoutProps {
    breadcrumb: string;
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
}

export function FormLayout({ breadcrumb, title, subtitle, children }: FormLayoutProps) {
    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">{breadcrumb}</p>
                <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">{title}</h1>
                {subtitle && <div className="pt-2">{subtitle}</div>}
            </header>
            {children}
        </div>
    );
}
