"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { apiClient } from "@/lib/api-client";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setIsSuccess(false);
        setError("");

        try {
            const response = await apiClient.post('/auth/admin/password/forgot', { email });

            if (response.success) {
                setIsSuccess(true);
                // Redirect to verify OTP page with email
                setTimeout(() => {
                    window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
                }, 1500);
            }
        } catch (err) {
            const error = err as Error & { data?: { error?: { details?: Array<{ field: string; message: string }> } } };
            if (error.data?.error?.details && error.data.error.details.length > 0) {
                // Show first validation error
                const firstError = error.data.error.details[0];
                setError(`${firstError.field}: ${firstError.message}`);
            } else {
                setError(err instanceof Error ? err.message : 'An error occurred');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-primary px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16 flex flex-col items-center justify-center">
            <div className="mb-8 flex flex-col items-center">
                <UntitledLogo className="h-12 w-auto mb-2" />
                <h1 className="text-xl font-bold text-primary">Pin N Post</h1>
            </div>
            <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-secondary bg-primary p-6 shadow-lg sm:space-y-8 sm:p-8">
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-semibold tracking-tight text-primary sm:text-display-xs md:text-display-sm">
                        Forgot password
                    </h2>
                    <p className="text-sm text-tertiary sm:text-md">
                        Enter the email associated with your account and we&apos;ll send you a one-time passcode to secure your reset.
                    </p>
                </div>

                <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
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

                    {error && (
                        <p className="text-sm text-error-primary">
                            {error}
                        </p>
                    )}

                    {isSuccess && (
                        <p className="text-sm text-success-primary">
                            If an account exists for this email, you&apos;ll receive a verification code shortly.
                        </p>
                    )}

                    <Button type="submit" className="w-full" isLoading={isSubmitting} isDisabled={isSubmitting}>
                        {isSubmitting ? "Sending code..." : "Send verification code"}
                    </Button>
                </form>

                <div className="space-y-2 text-center text-sm">
                    <a href="/verify-otp" className="block font-medium text-brand-primary hover:text-brand-secondary">
                        Already have a code? Verify it
                    </a>
                    <a href="/login" className="block font-medium text-brand-primary hover:text-brand-secondary">
                        Back to sign in
                    </a>
                </div>
            </div>
        </div>
    );
}
