"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextField } from "@/components/base/input/input";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate login logic
        setTimeout(() => {
            setIsLoading(false);
            // Here you would handle actual authentication
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-primary px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16 flex flex-col items-center justify-center">
            <h1 className="text-2xl text-center mb-10  font-bold text-primary">App Name</h1>
            <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-lg sm:space-y-8 sm:p-8">
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-semibold tracking-tight text-primary sm:text-display-xs md:text-display-sm">
                        Sign in to your account
                    </h2>
                    <p className="text-sm text-tertiary sm:text-md">
                        Or{" "}
                        <a href="#" className="font-medium text-brand-primary hover:text-brand-secondary">
                            create a new account
                        </a>
                    </p>
                </div>
                <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <TextField value={email} onChange={setEmail} className="space-y-1">
                            <Input
                                label="Email address"
                                type="email"
                                placeholder="Enter your email"
                                isRequired
                                size="md"
                            />
                        </TextField>

                        <TextField value={password} onChange={setPassword} className="space-y-1">
                            <Input
                                label="Password"
                                type="password"
                                placeholder="Enter your password"
                                isRequired
                                size="md"
                            />
                        </TextField>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-secondary rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 text-sm text-primary">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="#" className="font-medium text-brand-primary hover:text-brand-secondary">
                                Forgot your password?
                            </a>
                        </div>
                    </div>

                    <div>
                        <Button
                            type="submit"
                            size="md"
                            className="w-full"
                            isDisabled={isLoading}
                            isLoading={isLoading}
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
