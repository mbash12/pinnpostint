"use client";

import { useState } from "react";
import React from "react";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Button } from "@/components/base/buttons/button";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/use-users";
import { useChangePassword } from "@/hooks/use-auth";
import { AlertDialog } from "@/components/application/modals/alert-dialog";
import type { User } from "@/lib/api-types";
import { Camera01 } from "@untitledui/icons";
import { getProxiedImageUrl } from "@/utils/image-proxy";

export default function ProfilePage() {
    const { data: profileResponse, isLoading } = useProfile();
    const updateProfile = useUpdateProfile();
    const uploadAvatar = useUploadAvatar();
    const changePassword = useChangePassword();
    const [formData, setFormData] = useState({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [alertDialog, setAlertDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: "success" | "error" | "warning" | "info";
    }>({ isOpen: false, title: "", description: "", type: "info" });

    const user = (profileResponse?.data as any) as User;

    // Initialize form data when profile loads
    React.useEffect(() => {
        if (user) {
            setFormData({
                email: user.email || "",
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                phone: user.phone || "",
            });
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Send all fields even if empty to allow clearing them
            const filteredData = {
                email: formData.email || null,
                firstName: formData.firstName || null,
                lastName: formData.lastName || null,
                phone: formData.phone || null,
            };

            await updateProfile.mutateAsync(filteredData);
            setIsEditing(false);
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Profile Update Failed",
                description: error?.message || "Failed to update profile. Please try again.",
                type: "error",
            });
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setAlertDialog({
                isOpen: true,
                title: "Passwords Don't Match",
                description: "The new password and confirmation password do not match. Please try again.",
                type: "error",
            });
            return;
        }
        
        // Validate password strength
        if (passwordData.newPassword.length < 8) {
            setAlertDialog({
                isOpen: true,
                title: "Password Too Short",
                description: "New password must be at least 8 characters long.",
                type: "error",
            });
            return;
        }
        
        try {
            const response = await changePassword.mutateAsync({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
                confirmPassword: passwordData.confirmPassword,
            });
            
            if (response.success) {
                setAlertDialog({
                    isOpen: true,
                    title: "Password Changed",
                    description: "Your password has been changed successfully!",
                    type: "success",
                });
                setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                });
                setIsChangingPassword(false);
            }
        } catch (error: any) {
            const errorMessage = error?.message || "Failed to change password. Please check your current password and try again.";
            setAlertDialog({
                isOpen: true,
                title: "Password Change Failed",
                description: errorMessage,
                type: "error",
            });
        }
    };

    const handleCancel = () => {
        if (user) {
            setFormData({
                email: user.email || "",
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                phone: user.phone || "",
            });
        }
        setIsEditing(false);
    };

    const handlePasswordCancel = () => {
        setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
        setIsChangingPassword(false);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleAvatarUpload = async () => {
        if (!selectedFile) return;

        try {
            // First, upload the image file
            const uploadResponse = await uploadAvatar.mutateAsync(selectedFile);
            
            if (uploadResponse.success && uploadResponse.data) {
                // Then, update the profile with the new avatar URL
                await updateProfile.mutateAsync({
                    avatar: uploadResponse.data.url
                });
                
                // Clear the preview and selected file
                setSelectedFile(null);
                setPreviewUrl(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        } catch (error: any) {
            setAlertDialog({
                isOpen: true,
                title: "Avatar Upload Failed",
                description: error?.message || "Failed to upload avatar. Please try again.",
                type: "error",
            });
        }
    };

    const handleAvatarCancel = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-primary px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-4xl">
                    <div className="animate-pulse">
                        <div className="h-8 bg-secondary rounded w-1/4 mb-4"></div>
                        <div className="h-64 bg-secondary rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-primary px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-4xl text-center">
                    <p className="text-tertiary">Failed to load profile data.</p>
                </div>
            </div>
        );
    }

    const fullName = `${user.firstName} ${user.lastName || ""}`.trim();

    return (
        <div className="min-h-screen bg-primary px-4 py-6 sm:px-6 lg:px-8">
            <header className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold text-primary sm:text-display-xs">Profile</h1>
                </div>
                
            </header>

            <main className="mx-auto mt-6 w-full max-w-4xl space-y-6">
                    <form
                        id="profileForm"
                        onSubmit={handleSubmit}
                        className="rounded-xl border border-secondary bg-primary shadow-sm"
                    >
                        <div className="flex flex-col gap-1 border-b border-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-primary">Profile Details</h3>
                            </div>
                            {!isEditing && (
                                <Button color="secondary" size="sm" onClick={() => setIsEditing(true)}>
                                    Edit Profile
                                </Button>
                            )}
                        </div>
                        
                        <div className="border-b border-secondary px-5 py-5">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-secondary">
                                        <img
                                            src={
                                                previewUrl ||
                                                getProxiedImageUrl(user.avatar) ||
                                                `https://www.untitledui.com/images/avatars/transparent/${user.firstName?.toLowerCase() || "user"}-profile?bg=%23E0E0E0`
                                            }
                                            alt={fullName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white shadow-md transition-colors hover:bg-brand-secondary"
                                        title="Change avatar"
                                    >
                                        <Camera01 className="h-3.5 w-3.5" />
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-primary">Profile Picture</h4>
                                    <p className="text-xs text-tertiary">Click the camera icon to upload a new photo</p>
                                    {selectedFile && (
                                        <div className="mt-2 flex gap-2">
                                            <Button 
                                                color="primary" 
                                                size="sm" 
                                                onClick={handleAvatarUpload}
                                                isLoading={uploadAvatar.isPending || updateProfile.isPending}
                                                isDisabled={uploadAvatar.isPending || updateProfile.isPending}
                                            >
                                                {uploadAvatar.isPending ? "Uploading..." : updateProfile.isPending ? "Saving..." : "Upload"}
                                            </Button>
                                            <Button 
                                                color="secondary" 
                                                size="sm" 
                                                onClick={handleAvatarCancel}
                                                isDisabled={uploadAvatar.isPending || updateProfile.isPending}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary" htmlFor="profile-email">
                                    Email
                                </label>
                                {isEditing ? (
                                    <input
                                        id="profile-email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                        required
                                    />
                                ) : (
                                    <p className="py-2 text-sm text-primary">
                                        {user.email}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary" htmlFor="profile-first-name">
                                    First Name
                                </label>
                                {isEditing ? (
                                    <input
                                        id="profile-first-name"
                                        type="text"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                        required
                                    />
                                ) : (
                                    <p className="py-2 text-sm text-primary">
                                        {user.firstName}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary" htmlFor="profile-last-name">
                                    Last Name
                                </label>
                                {isEditing ? (
                                    <input
                                        id="profile-last-name"
                                        type="text"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                    />
                                ) : (
                                    <p className="py-2 text-sm text-primary">
                                        {user.lastName || "Not provided"}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary" htmlFor="profile-phone">
                                    Phone
                                </label>
                                {isEditing ? (
                                    <input
                                        id="profile-phone"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                    />
                                ) : (
                                    <p className="py-2 text-sm text-primary">
                                        {user.phone || "Not provided"}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary">
                                    Role
                                </label>
                                <p className="py-2 text-sm text-primary">
                                    {(user.role || "user").charAt(0).toUpperCase() + (user.role || "user").slice(1)}
                                </p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary">
                                    Account Status
                                </label>
                                <p className="py-2 text-sm">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            user.isActive
                                                ? "bg-success-subtle text-success-primary"
                                                : "bg-error-subtle text-error-primary"
                                        }`}
                                    >
                                        {user.isActive ? "Active" : "Inactive"}
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-tertiary">
                                    Email Verified
                                </label>
                                <p className="py-2 text-sm text-primary">
                                    {user.isVerified ? "✓ Verified" : "✗ Not Verified"}
                                </p>
                            </div>
                        </div>
                        {isEditing && (
                            <div className="flex flex-col-reverse gap-3 border-t border-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-tertiary">
                                    Changes apply across analytics dashboards, notifications, and billing statements.
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button color="secondary" size="sm" onClick={handleCancel}>
                                        Cancel
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="sm"
                                        type="submit"
                                        form="profileForm"
                                        isDisabled={updateProfile.isPending}
                                        isLoading={updateProfile.isPending}
                                        showTextWhileLoading
                                    >
                                        {updateProfile.isPending ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-base font-semibold text-primary">Security Recommendations</h3>
                                <p className="text-sm text-tertiary">Regularly update your password to keep your account secure.</p>
                            </div>
                            {!isChangingPassword && (
                                <Button color="secondary" size="sm" onClick={() => setIsChangingPassword(true)}>
                                    Change Password
                                </Button>
                            )}
                        </div>
                        {isChangingPassword && (
                            <form id="passwordForm" onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-tertiary" htmlFor="current-password">
                                        Current Password
                                    </label>
                                    <input
                                        id="current-password"
                                        type="password"
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-tertiary" htmlFor="new-password">
                                        New Password
                                    </label>
                                    <input
                                        id="new-password"
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                        required
                                        minLength={8}
                                        maxLength={128}
                                        placeholder="Must be at least 8 characters"
                                    />
                                    <p className="text-xs text-tertiary">Must contain at least one uppercase, lowercase, number, and special character</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-tertiary" htmlFor="confirm-password">
                                        Confirm New Password
                                    </label>
                                    <input
                                        id="confirm-password"
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                        required
                                        minLength={8}
                                        maxLength={128}
                                        placeholder="Re-enter your new password"
                                    />
                                </div>
                                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-tertiary">We&apos;ll notify you via email if any unusual activity is detected.</p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button 
                                            color="secondary" 
                                            size="sm" 
                                            onClick={handlePasswordCancel}
                                            isDisabled={changePassword.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button 
                                            color="primary" 
                                            size="sm" 
                                            type="submit"
                                            isDisabled={changePassword.isPending}
                                            isLoading={changePassword.isPending}
                                            showTextWhileLoading
                                        >
                                            {changePassword.isPending ? "Changing..." : "Change Password"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
            </main>

            {isChangingPassword && (
                <div className="fixed inset-x-0 bottom-4 mx-auto w-full max-w-xs rounded-full border border-secondary bg-primary px-4 py-2 text-center text-xs text-tertiary shadow-lg lg:hidden">
                    Password form is active. Scroll to complete the update.
                </div>
            )}

            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        </div>
    );
}
