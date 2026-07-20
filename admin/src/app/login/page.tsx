"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextField } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { useAuth } from "@/providers/auth-provider";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            await login({ email, password });
            router.push("/dashboard");
        } catch (error: any) {
            setError(error.message || "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <div className="mb-8 flex flex-col items-center">
                <UntitledLogo className="h-12 w-auto mb-2" />
                <h1 className="text-xl font-bold text-primary">Pin N Post</h1>
            </div>
            <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-lg sm:space-y-8 sm:p-8">
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-semibold tracking-tight text-primary sm:text-display-xs md:text-display-sm">Sign in to your account</h2>
                    {/* <p className="text-sm text-tertiary sm:text-md">
                        Or{" "}
                        <a href="#" className="font-medium text-brand-primary hover:text-brand-secondary">
                            create a new account
                        </a>
                    </p> */}
                </div>

                {error && <div className="bg-error-subtle border-error-primary rounded-lg border p-3 text-sm text-error-primary">{error}</div>}

                <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <Input
                            value={email}
                            onChange={setEmail}
                            className="space-y-1"
                            label="Email address"
                            type="email"
                            placeholder="Enter your email"
                            isRequired
                            size="md"
                            name="email"
                        />

                        <div className="relative">
                            <Input
                                value={password}
                                onChange={setPassword}
                                className="space-y-1"
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                isRequired
                                size="md"
                                name="password"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute top-[2.6rem] right-3 text-fg-quaternary hover:text-fg-quaternary_hover focus:text-fg-quaternary_hover"
                            >
                                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="focus:ring-brand-primary h-4 w-4 rounded border-secondary text-brand-primary"
                            />
                            <label htmlFor="remember-me" className="ml-2 text-sm text-primary">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="/forgot-password" className="font-medium text-brand-primary hover:text-brand-secondary">
                                Forgot your password?
                            </a>
                        </div>
                    </div>

                    <div>
                        <Button type="submit" size="md" className="w-full" isDisabled={isLoading} isLoading={isLoading}>
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
