const MS_PER_DAY = 86_400_000;

function startOfLocalDay(d: Date): number {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
}

/**
 * Human-readable chat timestamps: includes calendar context (today / yesterday / date) + time.
 */
export function formatChatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    const now = new Date();
    const dayDiff = Math.floor((startOfLocalDay(now) - startOfLocalDay(d)) / MS_PER_DAY);

    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

    if (dayDiff === 0) {
        return `Today, ${time}`;
    }
    if (dayDiff === 1) {
        return `Yesterday, ${time}`;
    }

    const sameYear = d.getFullYear() === now.getFullYear();
    const datePart = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
    return `${datePart}, ${time}`;
}
