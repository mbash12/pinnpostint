"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { apiClient } from "@/lib/api-client";

export default function VerifyOtpPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';

    const [code, setCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);

    // Countdown timer for resend cooldown
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setIsSuccess(false);
        setError("");

        if (!email) {
            setError("Email not found. Please request a new verification code.");
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await apiClient.post('/auth/admin/password/verify-reset-otp', { email, otp: code });

            if (response.success && response.data) {
                setIsSuccess(true);
                // Store reset token for next step
                const data = response.data as { resetToken: string };
                localStorage.setItem('resetToken', data.resetToken);
                setTimeout(() => {
                    router.push('/set-new-password');
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

    const handleResend = async () => {
        setIsSubmitting(true);
        setError("");
        setIsSuccess(false);

        try {
            const response = await apiClient.post('/auth/admin/password/forgot', { email });

            if (response.success) {
                setIsSuccess(true);
                setError("");
                // Start 60-second cooldown
                setResendCooldown(60);
                setTimeout(() => setIsSuccess(false), 3000);
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
                        Verify security code
                    </h2>
                    <p className="text-sm text-tertiary sm:text-md">
                        Enter the 6-digit code we just sent to your email to finish securing your account.
                    </p>
                </div>

                <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                    <Input
                        value={code}
                        onChange={setCode}
                        className="space-y-1"
                        label="Verification code"
                        placeholder="Enter your 6-digit code"
                        inputMode="numeric"
                        maxLength={6}
                        isRequired
                        size="md"
                        name="code"
                    />

                    {error && (
                        <p className="text-sm text-error-primary">
                            {error}
                        </p>
                    )}

                    {isSuccess && (
                        <p className="text-sm text-success-primary">
                            Code verified successfully! Redirecting...
                        </p>
                    )}

                    <Button type="submit" className="w-full" isLoading={isSubmitting} isDisabled={isSubmitting}>
                        {isSubmitting ? "Verifying..." : "Verify code"}
                    </Button>
                </form>

                <div className="space-y-3 text-center text-sm">
                    <button
                        type="button"
                        className="font-medium text-brand-primary hover:text-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleResend}
                        disabled={isSubmitting || resendCooldown > 0}
                    >
                        {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : 'Resend code'
                        }
                    </button>
                    <div>
                        <a href="/login" className="font-medium text-brand-primary hover:text-brand-secondary">
                            Back to sign in
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
