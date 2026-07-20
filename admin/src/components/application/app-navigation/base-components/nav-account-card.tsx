"use client";

import type { FC, HTMLAttributes } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { Placement } from "@react-types/overlays";
import { BookOpen01, ChevronSelectorVertical, LogOut01, Plus, Settings01, User01 } from "@untitledui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFocusManager } from "react-aria";
import type { DialogProps as AriaDialogProps } from "react-aria-components";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/utils/cx";
import { useAuth } from "@/providers/auth-provider";
import type { User } from "@/lib/api-types";
import { getProxiedImageUrl } from "@/utils/image-proxy";
import { ThemeToggle } from "@/components/base/theme/theme-toggle";


export const NavAccountMenu = ({ className, ...dialogProps }: AriaDialogProps & { className?: string }) => {
    const focusManager = useFocusManager();
    const dialogRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    focusManager?.focusNext({ tabbable: true, wrap: true });
                    break;
                case "ArrowUp":
                    focusManager?.focusPrevious({ tabbable: true, wrap: true });
                    break;
            }
        },
        [focusManager],
    );

    useEffect(() => {
        const element = dialogRef.current;
        if (element) {
            element.addEventListener("keydown", onKeyDown);
        }

        return () => {
            if (element) {
                element.removeEventListener("keydown", onKeyDown);
            }
        };
    }, [onKeyDown]);

    return (
        <AriaDialog
            {...dialogProps}
            ref={dialogRef}
            className={cx("w-66 rounded-xl bg-secondary_alt shadow-lg ring ring-secondary_alt outline-hidden", className)}
        >
            <div className="rounded-xl bg-primary ring-1 ring-secondary">
                <div className="flex flex-col gap-0.5 py-1.5">
                    <NavAccountCardMenuItem label="View profile" icon={User01} shortcut="⌘K->P" href="/dashboard/profile" />
                    <NavAccountCardMenuItem label="Account settings" icon={Settings01} shortcut="⌘S" />
                </div>
            </div>

            <div className="rounded-xl bg-primary ring-1 ring-secondary">
                <div className="p-1.5">
                    <ThemeToggle />
                </div>
            </div>

            <div className="pt-1 pb-1.5">
                <NavAccountCardMenuItem label="Logout" icon={LogOut01} shortcut="⌥⇧Q" onClick={handleLogout} />
            </div>
        </AriaDialog>
    );
};

const NavAccountCardMenuItem = ({
    icon: Icon,
    label,
    shortcut,
    href,
    ...buttonProps
}: {
    icon?: FC<{ className?: string }>;
    label: string;
    shortcut?: string;
    href?: string;
} & HTMLAttributes<HTMLButtonElement>) => {
    const content = (
        <div
            className={cx(
                "flex w-full items-center justify-between gap-3 rounded-md p-2 group-hover/item:bg-primary_hover",
                // Focus styles.
                "outline-focus-ring group-focus-visible/item:outline-2 group-focus-visible/item:outline-offset-2",
            )}
        >
            <div className="flex gap-2 text-sm font-semibold text-secondary group-hover/item:text-secondary_hover">
                {Icon && <Icon className="size-5 text-fg-quaternary" />} {label}
            </div>

            {shortcut && (
                <kbd className="flex rounded px-1 py-px font-body text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">{shortcut}</kbd>
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} className={cx("group/item w-full cursor-pointer px-1.5 focus:outline-hidden", buttonProps.className)}>
                {content}
            </Link>
        );
    }

    return (
        <button {...buttonProps} className={cx("group/item w-full cursor-pointer px-1.5 focus:outline-hidden", buttonProps.className)}>
            {content}
        </button>
    );
};

export const NavAccountCard = ({
    popoverPlacement,
}: {
    popoverPlacement?: Placement;
}) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useBreakpoint("lg");
    const { user, isLoading } = useAuth();

    // Show loading state
    if (isLoading) {
        return (
            <div className="relative flex items-center gap-2 rounded-xl p-2 ring-1 ring-secondary ring-inset">
                <div className="flex items-center gap-2 w-full">
                    <div className="h-8 w-8 rounded-full bg-secondary animate-pulse" />
                    <div className="flex-1 space-y-1">
                        <div className="h-2.5 bg-secondary rounded w-16 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    // Show error state or fallback
    if (!user) {
        return (
            <div ref={triggerRef} className="relative flex items-center gap-2 rounded-xl p-2 ring-1 ring-secondary ring-inset">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                    <User01 className="h-4 w-4 text-tertiary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">Guest User</p>
                </div>
            </div>
        );
    }

    const fullName = `${user.firstName} ${user.lastName || ""}`.trim() || user.email;
    const avatarUrl = getProxiedImageUrl(user.avatar) ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + (user.lastName || ''))}&background=E0E0E0&color=333333&size=200`;

    return (
        <div ref={triggerRef} className="relative flex items-center gap-2 rounded-xl p-2 ring-1 ring-secondary ring-inset">
            <img
                src={avatarUrl}
                alt={fullName}
                className="h-8 w-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary truncate">{fullName}</p>
            </div>

            <AriaDialogTrigger>
                <AriaButton className="flex cursor-pointer items-center justify-center rounded-md p-1 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover pressed:text-fg-quaternary_hover">
                    <ChevronSelectorVertical className="size-4 shrink-0" />
                </AriaButton>
                <AriaPopover
                    placement={popoverPlacement ?? (isDesktop ? "right bottom" : "top right")}
                    triggerRef={triggerRef}
                    offset={8}
                    className={({ isEntering, isExiting }) =>
                        cx(
                            "origin-(--trigger-anchor-point) will-change-transform",
                            isEntering &&
                                "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                            isExiting &&
                                "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                        )
                    }
                >
                    <NavAccountMenu />
                </AriaPopover>
            </AriaDialogTrigger>
        </div>
    );
};
