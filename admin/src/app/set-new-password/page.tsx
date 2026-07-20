"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { apiClient } from "@/lib/api-client";

export default function SetNewPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(null);

    useEffect(() => {
        // Get reset token from localStorage
        const token = localStorage.getItem('resetToken');
        if (!token) {
            setFeedback("No reset token found. Please request a new password reset.");
            setTimeout(() => {
                router.push('/forgot-password');
            }, 2000);
        } else {
            setResetToken(token);
        }
    }, [router]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFeedback(null);

        if (password !== confirmPassword) {
            setFeedback("Passwords do not match. Please try again.");
            return;
        }

        if (!resetToken) {
            setFeedback("No reset token found. Please request a new password reset.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await apiClient.post('/auth/admin/password/reset', {
                resetToken,
                newPassword: password
            });

            if (response.success) {
                // Clear the reset token
                localStorage.removeItem('resetToken');
                apiClient.setToken(null);
                setFeedback("Password updated successfully. Redirecting to login...");

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            }
        } catch (err) {
            const error = err as Error & { data?: { error?: { details?: Array<{ field: string; message: string }> } } };
            if (error.data?.error?.details && error.data.error.details.length > 0) {
                // Show first validation error
                const firstError = error.data.error.details[0];
                setFeedback(`${firstError.field}: ${firstError.message}`);
            } else {
                setFeedback(err instanceof Error ? err.message : 'An error occurred');
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
                        Set new password
                    </h2>
                    <p className="text-sm text-tertiary sm:text-md">
                        Create a strong password to secure your account.
                    </p>
                </div>

                <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
                    <Input
                        value={password}
                        onChange={setPassword}
                        className="space-y-1"
                        label="New password"
                        type="password"
                        placeholder="Minimum 6 alphanumeric characters"
                        isRequired
                        size="md"
                        name="password"
                    />

                    <Input
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        className="space-y-1"
                        label="Confirm password"
                        type="password"
                        placeholder="Re-enter new password"
                        isRequired
                        size="md"
                        name="confirmPassword"
                    />

                    {feedback && (
                        <p className={`text-sm ${feedback.includes("successfully") || feedback.includes("Password updated") ? "text-success-primary" : "text-error-primary"}`}>
                            {feedback}
                        </p>
                    )}

                    <Button type="submit" className="w-full" isLoading={isSubmitting} isDisabled={isSubmitting}>
                        {isSubmitting ? "Saving password..." : "Save new password"}
                    </Button>
                </form>

                <div className="space-y-2 text-center text-sm">
                    <a href="/login" className="block font-medium text-brand-primary hover:text-brand-secondary">
                        Back to sign in
                    </a>
                </div>
            </div>
        </div>
    );
}
