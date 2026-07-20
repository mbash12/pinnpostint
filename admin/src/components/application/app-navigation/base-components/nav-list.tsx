"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { NavItemDividerType, NavItemType } from "../config";
import { NavItemBase } from "./nav-item";

interface NavListProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** Additional CSS classes to apply to the list. */
    className?: string;
    /** List of items to display. */
    items: (NavItemType | NavItemDividerType)[];
}

export const NavList = React.memo(({ activeUrl, items, className }: NavListProps) => {
    // Track which parent items are expanded
    const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
        // Initialize with the parent of the active item if it exists
        const activeItemParent = items.find((item) =>
            item.href && item.items?.some((subItem) => subItem.href === activeUrl)
        );
        return activeItemParent?.href ? new Set([activeItemParent.href]) : new Set();
    });

    // Track user interactions to override auto-expansion
    const [userToggledItems, setUserToggledItems] = useState<Set<string>>(new Set());

    const activeItem = useMemo(() => items.find((item) => {
        if (item.href === activeUrl) return true;
        if (item.items?.some((subItem) => subItem.href === activeUrl)) return true;
        return false;
    }), [items, activeUrl]);

    const toggleItem = useCallback((href: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(href)) {
                newSet.delete(href);
            } else {
                newSet.add(href);
            }
            return newSet;
        });
        // Mark this item as user-toggled
        setUserToggledItems(prev => {
            const newSet = new Set(prev);
            newSet.add(href);
            return newSet;
        });
    }, []);

    // Auto-expand parent if child is active, but only if not manually toggled by user
    useEffect(() => {
        const activeParent = items.find((item) =>
            item.href && item.items?.some((subItem) => subItem.href === activeUrl)
        );
        const href = activeParent?.href;
        if (href && !userToggledItems.has(href)) {
            setExpandedItems(prev => {
                const newSet = new Set(prev);
                newSet.add(href);
                return newSet;
            });
        }
    }, [activeUrl, items, userToggledItems]);

    const renderedItems = useMemo(() => items.map((item, index) => {
        if (item.divider) {
            return (
                <li key={index} className="w-full px-0.5 py-2">
                    <hr className="h-px w-full border-none bg-border-secondary" />
                </li>
            );
        }

        if (item.items?.length) {
            const isExpanded = item.href ? expandedItems.has(item.href) : false;
            // Only highlight as active if the exact parent route is active, not just a child
            const isActiveParent = activeItem?.href === item.href;

            return (
                <div key={item.label} className="py-0.5">
                    <button
                        type="button"
                        className={cx(
                            "group relative flex w-full cursor-pointer items-center rounded-md bg-primary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 px-3 py-2",
                            isActiveParent && "bg-active hover:bg-secondary_hover"
                        )}
                        onClick={() => {
                            if (item.href) {
                                toggleItem(item.href);
                            }
                        }}
                        aria-expanded={isExpanded}
                        aria-haspopup="true"
                    >
                        {item.icon && <item.icon aria-hidden="true" className="mr-2 size-5 shrink-0 text-fg-quaternary transition-inherit-all" />}

                        <div className="flex-1 min-w-0">
                            <span
                                className={cx(
                                    "text-left text-md font-semibold text-secondary transition-inherit-all group-hover:text-secondary_hover truncate block",
                                    isActiveParent && "text-secondary_hover"
                                )}
                            >
                                {item.label}
                            </span>

                            {item.badge && (typeof item.badge === "string" || typeof item.badge === "number") ? (
                                <span className="ml-3 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 shrink-0">
                                    {item.badge}
                                </span>
                            ) : (
                                item.badge
                            )}
                        </div>

                        <ChevronDown
                            aria-hidden="true"
                            className={cx(
                                "ml-2 size-4 shrink-0 stroke-[2.5px] text-fg-quaternary transition-transform duration-200",
                                isExpanded && "rotate-180"
                            )}
                        />
                    </button>

                    {isExpanded && (
                        <ul className="py-0.5">
                            {item.items.map((childItem) => (
                                <li key={childItem.label} className="py-0.5">
                                    <NavItemBase
                                        href={childItem.href}
                                        badge={childItem.badge}
                                        type="collapsible-child"
                                        current={activeUrl === childItem.href}
                                    >
                                        {childItem.label}
                                    </NavItemBase>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            );
        }

        return (
            <li key={item.label} className="py-0.5">
                <NavItemBase
                    type="link"
                    badge={item.badge}
                    icon={item.icon}
                    href={item.href}
                    current={activeItem?.href === item.href}
                >
                    {item.label}
                </NavItemBase>
            </li>
        );
    }), [items, activeUrl, expandedItems, activeItem, toggleItem, userToggledItems]);

    return (
        <ul className={cx("mt-4 flex flex-col px-2 lg:px-4", className)}>
            {renderedItems}
        </ul>
    );
});

NavList.displayName = 'NavList';
