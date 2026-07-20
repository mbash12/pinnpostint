"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Calendar,
    User01,
    AlertTriangle,
    CheckCircle,
    SearchSm,
    XCircle,
    Clock,
    Send01,
    RefreshCw01,
    MessageXSquare,
    RefreshCw02,
} from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { TextArea } from "@/components/base/textarea/textarea";
import { Input } from "@/components/base/input/input";
import { useComplaint, useUpdateComplaintStatus } from "@/hooks/use-complaints";
import { Complaint, ComplaintStatus } from "@/lib/api-types";
import { useFormAlert } from "@/hooks/use-form-alert";
import { apiClient } from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// Format relative time helper
const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

// Message types
interface ComplaintMessage {
    id: string;
    complaintId: string;
    senderId: string;
    senderType: 'REPORTER' | 'RESPONDENT' | 'ADMIN';
    message: string;
    createdAt: string;
    sender?: {
        id: string;
        firstName: string;
        lastName: string;
    };
}

const statusConfig: Record<ComplaintStatus, { color: 'warning' | 'brand' | 'success' | 'error'; icon: React.ElementType; label: string }> = {
    OPEN: { color: 'warning', icon: AlertTriangle, label: 'Open' },
    INVESTIGATING: { color: 'brand', icon: SearchSm, label: 'Investigating' },
    RESOLVED: { color: 'success', icon: CheckCircle, label: 'Resolved' },
    REJECTED: { color: 'error', icon: XCircle, label: 'Rejected' },
};

// Fetch messages
const fetchComplaintMessages = async (complaintId: string): Promise<ComplaintMessage[]> => {
    const response = await apiClient.get<any>(`/admin/complaints/${complaintId}/messages`);
    // API returns { success: true, data: [...], pagination } for messages
    return response?.data || [];
};

// Send message
const sendComplaintMessage = async (complaintId: string, message: string) => {
    const response = await apiClient.post<any>(`/admin/complaints/${complaintId}/messages`, { message });
    return response;
};

export default function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { showAlert } = useFormAlert();

    // Await params in Next.js 15
    const resolvedParams = React.use(params);
    const { data: complaintResponse, isLoading } = useComplaint(resolvedParams.id);
    const updateStatusMutation = useUpdateComplaintStatus();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [resolutionNote, setResolutionNote] = useState("");
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [resolveAction, setResolveAction] = useState<'RESOLVED' | 'REJECTED' | null>(null);
    const [messageText, setMessageText] = useState("");

    const complaint = complaintResponse?.data;

    // Fetch messages
    const { data: messages = [], refetch: refetchMessages, isFetching: isFetchingMessages } = useQuery({
        queryKey: ['complaint-messages', resolvedParams.id],
        queryFn: () => fetchComplaintMessages(resolvedParams.id),
        enabled: !!resolvedParams.id,
    });

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: () => sendComplaintMessage(resolvedParams.id, messageText),
        onSuccess: () => {
            setMessageText("");
            refetchMessages();
        },
    });

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleStatusUpdate = async (newStatus: ComplaintStatus) => {
        if (newStatus === 'RESOLVED' || newStatus === 'REJECTED') {
            if (!resolutionNote.trim()) {
                showAlert("Resolution Note Required", "Please provide a resolution note explaining your decision.", "error");
                return;
            }
        }

        try {
            await updateStatusMutation.mutateAsync({
                complaintId: resolvedParams.id,
                data: {
                    status: newStatus,
                    resolutionNote: resolutionNote.trim() || undefined,
                }
            });
            showAlert("Success", `Complaint marked as ${statusConfig[newStatus].label}`, "success");
            setResolutionNote("");
            setShowResolveModal(false);
            setResolveAction(null);
        } catch (error: any) {
            showAlert("Error", error?.message || "Failed to update complaint status", "error");
        }
    };

    const handleSendMessage = () => {
        if (!messageText.trim()) return;
        sendMessageMutation.mutate();
    };

    const openResolveModal = (action: 'RESOLVED' | 'REJECTED') => {
        setResolveAction(action);
        setResolutionNote("");
        setShowResolveModal(true);
    };

    const getSidebarActions = (status: ComplaintStatus) => {
        const actions = [];

        if (status === 'OPEN') {
            actions.push({ label: 'Start Investigation', action: () => handleStatusUpdate('INVESTIGATING'), color: 'secondary', icon: SearchSm });
        }

        if (status === 'INVESTIGATING') {
            actions.push({ label: 'Resolve Complaint', action: () => openResolveModal('RESOLVED'), color: 'primary', icon: CheckCircle });
            actions.push({ label: 'Reject Complaint', action: () => openResolveModal('REJECTED'), color: 'primary-destructive', icon: XCircle });
        }

        if (status === 'RESOLVED' || status === 'REJECTED') {
            actions.push({ label: 'Reopen Complaint', action: () => handleStatusUpdate('OPEN'), color: 'secondary', icon: RefreshCw01 });
        }

        return actions;
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management/complaints">
                        Back to Complaints
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <p className="text-tertiary">Loading complaint details...</p>
                </div>
            </div>
        );
    }

    if (!complaint) {
        return (
            <div className="space-y-8">
                <header className="flex items-center gap-4">
                    <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management/complaints">
                        Back to Complaints
                    </Button>
                </header>
                <div className="rounded-2xl border border-secondary bg-primary p-12 text-center shadow-sm">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-error-primary" />
                    <h2 className="mb-2 text-lg font-semibold text-primary">Complaint not found</h2>
                    <p className="text-tertiary">The complaint you&apos;re looking for doesn&apos;t exist.</p>
                </div>
            </div>
        );
    }

    const config = statusConfig[complaint.status];
    const StatusIcon = config.icon;
    const sidebarActions = getSidebarActions(complaint.status);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <Button color="secondary" size="sm" iconLeading={<ArrowLeft />} href="/dashboard/booking-management/complaints">
                            Back
                        </Button>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold text-primary">Complaint #{complaint.id.substring(0, 8)}</h1>
                                <Badge color={config.color}>
                                    <span className="flex items-center gap-1">
                                        <StatusIcon className="size-3.5" />
                                        {config.label}
                                    </span>
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-tertiary">
                                <span className="flex items-center gap-1">
                                    <Calendar className="size-4" />
                                    {new Date(complaint.createdAt).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="size-4" />
                                    {new Date(complaint.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Complaint Description */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-error-primary" />
                            Complaint Description
                        </h2>
                        <p className="text-primary whitespace-pre-wrap">{complaint.description}</p>
                    </div>

                    {/* Discussion Thread */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                                <MessageXSquare className="h-5 w-5 text-brand-primary" />
                                Discussion
                            </h2>
                            <Button
                                color="secondary"
                                size="sm"
                                iconLeading={<RefreshCw02 className="size-4" />}
                                onClick={() => refetchMessages()}
                                disabled={isFetchingMessages}
                            >
                                Refresh
                            </Button>
                        </div>
                        
                        <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4 pr-2">
                            {messages.length === 0 ? (
                                <p className="text-tertiary text-center py-8">No messages yet. Start the discussion as moderator.</p>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex gap-3 ${msg.senderType === 'ADMIN' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            msg.senderType === 'ADMIN' ? 'bg-brand-primary text-white' :
                                            msg.senderType === 'REPORTER' ? 'bg-warning-subtle text-warning-primary' :
                                            'bg-success-subtle text-success-primary'
                                        }`}>
                                            <User01 className="size-4" />
                                        </div>
                                        <div className={`max-w-[70%] ${msg.senderType === 'ADMIN' ? 'text-right' : ''}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium text-primary">
                                                    {msg.senderType === 'ADMIN' ? 'You (Admin)' : 
                                                     msg.senderType === 'REPORTER' ? 'Reporter (Customer)' : 
                                                     'Service Provider (Seller)'}
                                                </span>
                                                <span className="text-xs text-tertiary">
                                                    {formatRelativeTime(new Date(msg.createdAt))}
                                                </span>
                                            </div>
                                            <div className={`inline-block rounded-lg px-4 py-2 text-sm ${
                                                msg.senderType === 'ADMIN' ? 'bg-brand-subtle text-primary text-left' :
                                                'bg-secondary text-primary'
                                            }`}>
                                                {msg.message}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="flex gap-3 pt-4 border-t border-secondary">
                            <Input
                                placeholder="Type your message as moderator..."
                                value={messageText}
                                onChange={setMessageText}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                className="flex-1"
                            />
                            <Button
                                color="primary"
                                size="sm"
                                iconLeading={<Send01 className="size-4" />}
                                onClick={handleSendMessage}
                                disabled={!messageText.trim() || sendMessageMutation.isPending}
                            >
                                Send
                            </Button>
                        </div>
                    </div>

                    {/* Admin Resolution */}
                    {complaint.resolutionNote && (
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-brand-primary" />
                                Resolution Note
                            </h2>
                            {complaint.adminResolver && (
                                <p className="text-sm text-tertiary mb-2">
                                    Resolved by {complaint.adminResolver.firstName} {complaint.adminResolver.lastName}
                                </p>
                            )}
                            <p className="text-primary whitespace-pre-wrap">{complaint.resolutionNote}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Reporter Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Reporter (Customer)</h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-warning-subtle">
                                    <User01 className="h-5 w-5 text-warning-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-primary">{complaint.reporter.firstName} {complaint.reporter.lastName}</p>
                                    <p className="text-sm text-tertiary">{complaint.reporter.email}</p>
                                    <p className="text-xs text-tertiary">{complaint.reporter.phone || 'No phone'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Service Provider Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Service Provider (Seller)</h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-success-subtle">
                                    <User01 className="h-5 w-5 text-success-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold text-primary">{complaint.respondent.firstName} {complaint.respondent.lastName}</p>
                                    <p className="text-sm text-tertiary">{complaint.respondent.email}</p>
                                    <p className="text-xs text-tertiary">{complaint.respondent.phone || 'No phone'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Information */}
                    <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-primary mb-4">Booking Information</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-tertiary">Service</span>
                                <span className="font-medium text-primary text-right">{complaint.booking.ad.title}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary">Booking Date</span>
                                <span className="font-medium text-primary">
                                    {new Date(complaint.booking.startDate).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-tertiary">Booking ID</span>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    href={`/dashboard/booking-management/${complaint.bookingId}`}
                                    className="p-0 h-auto underline text-xs"
                                >
                                    #{complaint.bookingId.substring(0, 8)}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {sidebarActions.length > 0 && (
                        <div className="bg-primary border border-secondary rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-primary mb-4">Actions</h2>
                            <div className="space-y-2">
                                {sidebarActions.map((action, index) => (
                                    <Button
                                        key={index}
                                        color={action.color as any}
                                        size="sm"
                                        iconLeading={<action.icon className="size-4" />}
                                        className="w-full justify-start"
                                        onClick={action.action}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Resolution Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-primary rounded-2xl border border-secondary shadow-lg w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-primary mb-2">
                            {resolveAction === 'RESOLVED' && 'Resolve Complaint'}
                            {resolveAction === 'REJECTED' && 'Reject Complaint'}
                        </h3>
                        <p className="text-sm text-tertiary mb-4">
                            {resolveAction === 'RESOLVED' && 'This will mark the complaint as resolved.'}
                            {resolveAction === 'REJECTED' && 'This will reject the complaint and close the case.'}
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">
                                    Resolution Note <span className="text-error-primary">*</span>
                                </label>
                                <TextArea
                                    value={resolutionNote}
                                    onChange={setResolutionNote}
                                    placeholder="Provide a detailed explanation for your decision..."
                                    rows={4}
                                />
                                <p className="mt-1 text-xs text-tertiary">
                                    This note will be visible to both the reporter and the service provider.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                color="secondary"
                                onClick={() => {
                                    setShowResolveModal(false);
                                    setResolveAction(null);
                                    setResolutionNote("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={resolveAction === 'RESOLVED' ? 'primary' : 'primary-destructive'}
                                onClick={() => resolveAction && handleStatusUpdate(resolveAction)}
                                disabled={!resolutionNote.trim() || updateStatusMutation.isPending}
                            >
                                {updateStatusMutation.isPending ? 'Processing...' :
                                 resolveAction === 'RESOLVED' ? 'Resolve Complaint' :
                                 'Reject Complaint'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
