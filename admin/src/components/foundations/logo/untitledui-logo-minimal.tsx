"use client";

import type { HTMLAttributes } from "react";
import Image from "next/image";
import { cx } from "@/utils/cx";
import logoImage from "../../../app/icon.png"; // Using the same logo as favicon

export const UntitledLogoMinimal = (props: HTMLAttributes<HTMLOrSVGElement>) => {
    return (
        <div {...props} className={cx("flex h-8 w-max items-center justify-start overflow-visible", props.className)}>
            <Image
                src={logoImage}
                alt="Pin N Post Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
            />
        </div>
    );
};
