"use client";

import { BookOpen01, Check, Copy01, Cube01, HelpCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";

import { useClipboard } from "@/hooks/use-clipboard";

export const HomeScreen = () => {
    const clipboard = useClipboard();

    return (
        <div className="flex h-dvh flex-col">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 md:px-8">
                <div className="relative flex size-28 items-center justify-center">
                    <h1 className="text-2xl font-bold text-primary">Pin N Post</h1>
                </div>

                <h1 className="max-w-3xl text-center text-display-sm font-semibold text-primary">Pin N Post Admin Dashboard</h1>

                <p className="mt-2 max-w-xl text-center text-lg text-tertiary">
                    Manage users, ads, content, and more for the Pin N Post platform.
                </p>

                <div className="relative mt-6 flex h-10 items-center rounded-lg border border-secondary bg-secondary">
                    <code className="px-3 font-mono text-secondary">pinandpost-admin</code>

                    <hr className="h-10 w-px bg-border-secondary" />

                    <ButtonUtility
                        color="tertiary"
                        size="sm"
                        tooltip="Copy"
                        className="mx-1"
                        icon={clipboard.copied ? Check : Copy01}
                        onClick={() => clipboard.copy("pinandpost-admin")}
                    />
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <Button
                        href="https://www.untitledui.com/react/docs/introduction"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={BookOpen01}
                    >
                        Docs
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        href="https://www.untitledui.com/react/resources/icons"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={Cube01}
                    >
                        Icons
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        href="https://github.com/untitleduico/react/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        color="link-color"
                        size="lg"
                        iconLeading={HelpCircle}
                    >
                        Help
                    </Button>
                </div>
            </div>
        </div>
    );
};
