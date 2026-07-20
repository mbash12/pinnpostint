import { ReactNode } from "react";

interface FormGridProps {
    cols?: 1 | 2 | 3;
    children: ReactNode;
}

export function FormGrid({ cols = 2, children }: FormGridProps) {
    const gridClass = {
        1: "grid gap-4 md:grid-cols-1",
        2: "grid gap-4 md:grid-cols-2",
        3: "grid gap-4 md:grid-cols-3",
    }[cols];

    return <div className={gridClass}>{children}</div>;
}
