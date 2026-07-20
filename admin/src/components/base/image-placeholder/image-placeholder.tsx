import { Image01 } from "@untitledui/icons";
import { cx } from "@/utils/cx";

interface ImagePlaceholderProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function ImagePlaceholder({ size = "sm", className }: ImagePlaceholderProps) {
    const sizeClasses = {
        sm: "h-10 w-10",
        md: "h-16 w-16", 
        lg: "h-24 w-24"
    };

    const iconSizes = {
        sm: "size-4",
        md: "size-6",
        lg: "size-8"
    };

    return (
        <div className={cx(
            "rounded-lg bg-secondary flex items-center justify-center",
            sizeClasses[size],
            className
        )}>
            <Image01 className={cx("text-tertiary", iconSizes[size])} />
        </div>
    );
}
