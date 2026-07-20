import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, ActivityIndicator, Linking, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { bookingsService , complaintsService, platformAdsService } from '@/services';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { GradientButton } from '@/components/ui/gradient-button';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { SideBanners } from '@/components/home/side-banners';
import { Colors, Shadows } from '@/constants/theme';
import { useAlert } from '@/components/ui/custom-alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { config } from '@/config/environment';
import { useAuth } from '@/contexts/auth-context';
import { ComplaintTracker, Complaint, ComplaintModals } from '@/components/complaint-components';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

// Define the ComplaintMessage interface locally since it's not imported from the service
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

// Define Transaction interface
interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentProvider: 'RAZORPAY';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdBookingDetailPage() {
  const router = useRouter();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.AD_BOOKING_DETAIL);
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [autoCompleteDays, setAutoCompleteDays] = useState(7);
  const [autoCancelDays, setAutoCancelDays] = useState(3);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [serviceFeeFixed, setServiceFeeFixed] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    status: string;
    destructive?: boolean;
  }>({
    visible: false,
    title: '',
    message: '',
    status: '',
  });
  const [rejectionReasonDialog, setRejectionReasonDialog] = useState<{
    visible: boolean;
  }>({
    visible: false,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  
  // State to determine if current user is seller or buyer
  const [isSeller, setIsSeller] = useState(false);
  const [isBuyer, setIsBuyer] = useState(false);

  // Messaging state for complaint discussions
  const [discussionModalVisible, setDiscussionModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [messages, setMessages] = useState<ComplaintMessage[]>([]);
  const [messageText, setMessageText] = useState('');

  // Action modal for resolving complaints
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const fetchPlatformAds = async () => {
      try {
        setIsLoadingPlatformAds(true);
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch (error) {
      } finally {
        setIsLoadingPlatformAds(false);
      }
    };
    fetchPlatformAds();
  }, []);

  useEffect(() => {
    const onChange = (result: any) => setScreenWidth(result.window.width);
    const handler = Platform.OS === 'web' ? Dimensions.addEventListener('change', onChange) : null;
    fetchBooking();
    return () => handler?.remove();
  }, [params.id, user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/public/system-settings`);
        const data = await response.json();
        if (data.success && data.data) {
          setAutoCompleteDays(data.data.autoCompleteBookingDays || 7);
          setAutoCancelDays(data.data.autoCancelBookingDays || 3);
          setServiceFeeFixed(data.data.serviceFeeFixed || 0);
        }
      } catch (error) {
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (params.id && booking) {
        try {
          setIsLoadingTransactions(true);
          const response = await bookingsService.getBookingTransactions(params.id as string);
          if (response.success && response.data) {
            setTransactions(response.data);
          }
        } catch (error) {
            } finally {
          setIsLoadingTransactions(false);
        }
      }
    };
    fetchTransactions();
  }, [params.id, booking]);

  // Calculate auto-complete/auto-cancel dates
  const getAutoProcessInfo = () => {
    if (!booking) return null;

    // Don't auto-process if there's an active complaint
    const hasActiveComplaint = booking.complaints && booking.complaints.some((c: Complaint) =>
      c.status === 'OPEN' || c.status === 'INVESTIGATING'
    );
    if (hasActiveComplaint) return null;

    const now = new Date();
    let autoDate: Date | null = null;
    let message = '';

    if (booking.status === 'CONFIRMED') {
      // Calculate auto-complete date
      if (booking.endDate) {
        autoDate = new Date(booking.endDate);
        autoDate.setDate(autoDate.getDate() + autoCompleteDays);
        const isPast = autoDate < now;
        message = isPast
          ? `This booking was scheduled to be auto-completed on ${autoDate.toLocaleDateString()}`
          : `This booking will be automatically marked as completed on ${autoDate.toLocaleDateString()}`;
        return { autoDate, message };
      }
    } else if (booking.status === 'SUBMITTED') {
      // Calculate auto-cancel date
      if (booking.startDate) {
        autoDate = new Date(booking.startDate);
        autoDate.setDate(autoDate.getDate() + autoCancelDays);
        const isPast = autoDate < now;
        message = isPast
          ? `This booking was scheduled to be auto-cancelled on ${autoDate.toLocaleDateString()}`
          : `This booking will be automatically cancelled if not confirmed by ${autoDate.toLocaleDateString()}`;
        return { autoDate, message };
      }
    }

    // Return null for COMPLETED, CANCELLED, or any other status
    return null;
  };

  const autoProcessInfo = getAutoProcessInfo();

  // Calculate auto-process card color based on status
  const autoProcessCardStyle = {
    backgroundColor: booking?.status === 'SUBMITTED' ? '#FFF3E0' : '#E8F5E9',
    borderLeftColor: booking?.status === 'SUBMITTED' ? '#FF9500' : '#34C759',
  };

  // Transaction helper functions
  const getTransactionStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '#34C759';
      case 'SUBMITTED':
        return '#FF9500';
      case 'FAILED':
        return '#FF3B30';
      case 'REFUNDED':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const getTransactionStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'check-circle';
      case 'SUBMITTED':
        return 'schedule';
      case 'FAILED':
        return 'cancel';
      case 'REFUNDED':
        return 'currency-exchange';
      default:
        return 'help';
    }
  };

  const fetchBooking = async () => {
    try {
      setIsLoading(true);
      const response = await bookingsService.getBooking(params.id as string);
      if (response.success && response.data) {
        setBooking(response.data);
        
        // Determine if current user is seller or buyer
        if (user && user.id) {
          if (user.id === response.data.userId) {
            setIsBuyer(true);
            setIsSeller(false);
          } else if (user.id === response.data.ad.userId) {
            setIsSeller(true);
            setIsBuyer(false);
          } else {
            // User is neither buyer nor seller - shouldn't happen in normal flow
            setIsBuyer(false);
            setIsSeller(false);
          }
        }
      } else {
        }
    } catch (error) {
      showAlert({ title: 'Error', message: 'Failed to load booking details', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    // For cancellation rejection or booking rejection, show reason input dialog
    if (status === 'REJECT_CANCELLATION' || status === 'CANCELLED') {
      setRejectionReasonDialog({ visible: true });
      setConfirmDialog(prev => ({ ...prev, status })); // Store which action triggered this
      return;
    }

    const messages: any = {
      CONFIRMED: { title: 'Confirm Booking', message: 'Are you sure you want to confirm this booking?' },
      APPROVE_CANCELLATION: { title: 'Approve Cancellation', message: 'Are you sure you want to approve this cancellation request?', destructive: true },
    };

    setConfirmDialog({
      visible: true,
      ...messages[status],
      status,
    });
  };

  const handleConfirmAction = async () => {
    const status = confirmDialog.status;
    setConfirmDialog({ ...confirmDialog, visible: false });

    try {
      setIsUpdating(true);
      let response;

      if (status === 'CONFIRMED') {
        response = await bookingsService.confirmBooking(booking.id);
      } else if (status === 'APPROVE_CANCELLATION') {
        response = await bookingsService.approveCancellation(booking.id);
      }

      if (response?.success) {
        const successMessage = response?.message || `Booking ${status.toLowerCase()}`;
        showAlert({ title: 'Success', message: successMessage, type: 'success' });
        fetchBooking();
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error?.message || 'Failed to update booking', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectWithReason = async () => {
    setRejectionReasonDialog({ visible: false });

    if (!rejectionReason.trim()) {
      showAlert({ title: 'Error', message: 'Please provide a reason for rejection', type: 'error' });
      return;
    }

    try {
      setIsUpdating(true);
      const actionType = confirmDialog.status;
      let response;

      // Determine which type of rejection based on the stored status
      if (actionType === 'CANCELLED') {
        // Rejecting a booking (SUBMITTED -> REJECTED)
        response = await bookingsService.rejectBooking(booking.id, rejectionReason);
      } else if (actionType === 'REJECT_CANCELLATION') {
        // Rejecting a cancellation request
        response = await bookingsService.rejectCancellation(booking.id, rejectionReason);
      }

      if (response?.success) {
        const successMessage = response?.message || (actionType === 'CANCELLED' ? 'Booking rejected' : 'Cancellation request rejected');
        showAlert({ title: 'Success', message: successMessage, type: 'success' });
        setRejectionReason('');
        fetchBooking();
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error?.message || 'Failed to process rejection', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Complaint handling functions
  const handleOpenDiscussion = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    
    try {
      // Load existing messages
      const response = await complaintsService.getComplaintMessages(complaint.id);
      if (response.success && response.data) {
        setMessages(response.data);
      } else {
        setMessages([]);
      }
    } catch (error) {
      setMessages([]);
      showAlert({ title: 'Error', message: 'Failed to load messages', type: 'error' });
    }
    
    setDiscussionModalVisible(true);
  };

  const handleCloseDiscussion = () => {
    setDiscussionModalVisible(false);
    setSelectedComplaint(null);
    setMessageText('');
    setMessages([]);
  };

  const handleRefreshMessages = async () => {
    if (!selectedComplaint) return;
    
    try {
      const response = await complaintsService.getComplaintMessages(selectedComplaint.id);
      if (response.success && response.data) {
        setMessages(response.data);
      } else {
        setMessages([]);
      }
    } catch (error) {
      // Silently fail during refresh
    }
  };

  const handleSendMessage = async () => {
    if (!selectedComplaint || !messageText.trim()) {
      showAlert({ title: 'Error', message: 'Please enter a message', type: 'error' });
      return;
    }

    try {
      const response = await complaintsService.sendMessage(selectedComplaint.id, messageText.trim());
      
      if (response.success) {
        // Add the new message to the list
        setMessages(prev => [...prev, response.data]);
        setMessageText('');

        // Refresh booking details to reflect the updated status
        fetchBooking();
      } else {
        showAlert({ title: 'Error', message: response.message || 'Failed to send message', type: 'error' });
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to send message', type: 'error' });
    }
  };

  const handleOpenActionModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setActionModalVisible(true);
    setResolutionNote('');
  };

  const handleCloseActionModal = () => {
    setActionModalVisible(false);
    setSelectedComplaint(null);
    setResolutionNote('');
  };

  const handleResolveWithRefund = async () => {
    if (!selectedComplaint) return;

    setIsProcessing(true);
    try {
      const response = await complaintsService.resolveWithRefund(selectedComplaint.id, resolutionNote);
      
      if (response.success) {
        showAlert({ title: 'Success', message: 'Complaint resolved with refund', type: 'success' });
        setActionModalVisible(false);
        setSelectedComplaint(null);
        setResolutionNote('');
        
        // Refresh booking details to reflect the updated status
        fetchBooking();
      } else {
        showAlert({ title: 'Error', message: response.message || 'Failed to resolve complaint', type: 'error' });
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to resolve complaint', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteWithoutRefund = async () => {
    if (!selectedComplaint) return;

    setIsProcessing(true);
    try {
      const response = await complaintsService.completeWithoutRefund(selectedComplaint.id, resolutionNote);
      
      if (response.success) {
        showAlert({ title: 'Success', message: 'Complaint completed without refund', type: 'success' });
        setActionModalVisible(false);
        setSelectedComplaint(null);
        setResolutionNote('');
        
        // Refresh booking details to reflect the updated status
        fetchBooking();
      } else {
        showAlert({ title: 'Error', message: response.message || 'Failed to complete complaint', type: 'error' });
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to complete complaint', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCall = () => {
    if (booking?.user?.phone) {
      Linking.openURL(`tel:${booking.user.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (booking?.user?.phone) {
      const cleanPhone = booking.user.phone.replace(/[^0-9]/g, '');
      // Add India country code (91) if not present
      const phoneWithCountryCode = cleanPhone.startsWith('91') 
        ? cleanPhone 
        : `91${cleanPhone.replace(/^0/, '')}`;
      Linking.openURL(`https://wa.me/${phoneWithCountryCode}`);
    }
  };

  const statusConfig: any = {
    SUBMITTED: { color: '#FF9500', icon: 'schedule', label: 'Pending' },
    CONFIRMED: { color: '#007AFF', icon: 'check-circle', label: 'Confirmed' },
    COMPLETED: { color: '#34C759', icon: 'check-circle-outline', label: 'Completed' },
    CANCELLED: { color: '#FF3B30', icon: 'cancel', label: 'Cancelled' },
    CANCELLATION_REQUESTED: { color: '#FF9500', icon: 'pending-actions', label: 'Cancellation Requested' },
  };

  if (isLoading) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  if (!booking) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color={Colors.light.textSecondary} />
            <ThemedText style={styles.errorText}>Booking not found</ThemedText>
            <TouchableOpacity onPress={goBack}>
              <ThemedText style={styles.backLink}>Go back</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  const config = statusConfig[booking.status] || {};

  return (
    <AuthProtection>
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8, paddingHorizontal: 16 }} />}
          <View style={isDesktop ? styles.desktopHomeWrapper : null}>
            {isDesktop && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                position={PlatformAdPosition.LEFT}
              />
            )}

            <View style={isDesktop ? styles.desktopMainContent : null}>
              <View style={[styles.content, isDesktop ? styles.desktopContent : null, { paddingTop: 40 }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={goBack} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <ThemedText style={styles.headerTitle}>Booking Details</ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig[booking.status]?.color || '#999' }]}>
                  <MaterialIcons name={statusConfig[booking.status]?.icon || 'info'} size={14} color="#FFFFFF" />
                  <ThemedText style={styles.statusText}>{statusConfig[booking.status]?.label || booking.status}</ThemedText>
                </View>
              </View>
            </View>

            {/* Customer Info Card - Simplified to match buyer's view */}
            {booking.user && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="person" size={24} color={Colors.light.primary} />
                  <ThemedText style={styles.cardTitle}>Customer</ThemedText>
                </View>

                <View style={styles.customerInfo}>
                  <View style={styles.avatar}>
                    <ThemedText style={styles.avatarText}>
                      {booking.user.firstName?.charAt(0)}{booking.user.lastName?.charAt(0)}
                    </ThemedText>
                  </View>
                  <View style={styles.customerDetails}>
                    <ThemedText style={styles.customerName}>
                      {booking.user.firstName} {booking.user.lastName}
                    </ThemedText>
                    {booking.user.phone && (
                      <View style={styles.contactRow}>
                        <MaterialIcons name="phone" size={16} color={Colors.light.textSecondary} />
                        <ThemedText style={styles.contactText}>{booking.user.phone}</ThemedText>
                      </View>
                    )}
                    {booking.user.email && (
                      <View style={styles.contactRow}>
                        <MaterialIcons name="email" size={16} color={Colors.light.textSecondary} />
                        <ThemedText style={styles.contactText}>{booking.user.email}</ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Contact buttons - kept below info like a secondary action */}
                {booking.user?.phone && (
                  <View style={styles.quickContactButtons}>
                    <TouchableOpacity style={styles.quickContactButton} onPress={handleCall}>
                      <MaterialIcons name="phone" size={18} color={Colors.light.primary} />
                      <ThemedText style={styles.quickContactButtonText}>Call</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quickContactButton, styles.quickContactWhatsApp]} onPress={handleWhatsApp}>
                      <MaterialIcons name="chat" size={18} color="#25D366" />
                      <ThemedText style={[styles.quickContactButtonText, { color: '#25D366' }]}>WhatsApp</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Booking Information Card - Matching buyer's view */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="event" size={24} color={Colors.light.primary} />
                <ThemedText style={styles.cardTitle}>Booking Information</ThemedText>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="calendar-today" size={18} color={Colors.light.primary} />
                </View>
                <View style={styles.infoContent}>
                  <ThemedText style={styles.infoLabel}>Date & Time</ThemedText>
                  {booking.bookingDate || booking.startDate ? (
                    <>
                      <ThemedText style={styles.infoValue}>
                        {new Date(booking.bookingDate || booking.startDate!).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </ThemedText>
                      {booking.slotId && (booking.ad?.slots || [])?.find((s: any) => s.id === booking.slotId) && (
                        <ThemedText style={styles.infoTime}>
                          {(booking.ad.slots.find((s: any) => s.id === booking.slotId) as any).startTime} - {(booking.ad.slots.find((s: any) => s.id === booking.slotId) as any).endTime}
                        </ThemedText>
                      )}
                      {!booking.slotId && (booking.bookingDate || booking.startDate) && (
                        <ThemedText style={styles.infoTime}>
                          {new Date(booking.bookingDate || booking.startDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                      )}
                    </>
                  ) : (
                    <>
                      <ThemedText style={styles.infoValue}>
                        {new Date(booking.createdAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </ThemedText>
                      <ThemedText style={styles.infoTime}>
                        {new Date(booking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </ThemedText>
                    </>
                  )}
                </View>
              </View>

              {booking.notes && (
                <View style={styles.infoRow}>
                  <View style={styles.iconCircle}>
                    <MaterialIcons name="notes" size={18} color={Colors.light.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <ThemedText style={styles.infoLabel}>Notes</ThemedText>
                    <ThemedText style={styles.infoValue}>{booking.notes}</ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.bookingIdRow}>
                <ThemedText style={styles.infoLabel}>Booking ID</ThemedText>
                <ThemedText style={styles.bookingId}>{booking.id.slice(0, 8)}</ThemedText>
              </View>
            </View>

            {/* Transactions Card */}
            {transactions && transactions.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="receipt" size={24} color={Colors.light.primary} />
                  <ThemedText style={styles.cardTitle}>Payment Transactions</ThemedText>
                </View>

                {transactions.map((transaction) => {
                  // Calculate base price (excluding service fee) for seller
                  const basePrice = Math.max(0, Number(transaction.amount) - serviceFeeFixed);
                  return (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <View style={[styles.transactionIcon, { backgroundColor: `${getTransactionStatusColor(transaction.status)}20` }]}>
                        <MaterialIcons
                          name={getTransactionStatusIcon(transaction.status) as any}
                          size={20}
                          color={getTransactionStatusColor(transaction.status)}
                        />
                      </View>
                      <View style={styles.transactionInfo}>
                        <ThemedText style={styles.transactionDescription}>
                          {transaction.description || 'Booking payment'}
                        </ThemedText>
                        <ThemedText style={styles.transactionDate}>
                          {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.transactionRight}>
                      <ThemedText style={styles.transactionAmount}>
                        {formatPrice(basePrice)}
                      </ThemedText>
                      <View style={[styles.transactionStatusBadge, { backgroundColor: getTransactionStatusColor(transaction.status) }]}>
                        <ThemedText style={styles.transactionStatusText}>{transaction.status}</ThemedText>
                      </View>
                    </View>
                  </View>
                )})}
              </View>
            )}

            {/* Auto-Process Info Card */}
            {autoProcessInfo && (
              <View style={[styles.autoProcessCard, autoProcessCardStyle]}>
                <View style={styles.autoProcessHeader}>
                  <MaterialIcons name="info-outline" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.autoProcessTitle}>
                    {booking.status === 'CONFIRMED' ? 'Auto-Completion' : 'Auto-Cancellation'} Info
                  </ThemedText>
                </View>
                <ThemedText style={styles.autoProcessText}>
                  {autoProcessInfo.message}
                </ThemedText>
                {autoProcessInfo.autoDate && (
                  <View style={styles.autoProcessDateBadge}>
                    <MaterialIcons name="schedule" size={14} color={Colors.light.primary} />
                    <ThemedText style={styles.autoProcessDateText}>
                      {booking.status === 'CONFIRMED' ? `${autoCompleteDays} days after end date` : `${autoCancelDays} days after start date`}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {/* Service Card - Simplified to match buyer's view */}
            {booking.ad && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MaterialIcons name="shopping-bag" size={24} color={Colors.light.primary} />
                  <ThemedText style={styles.cardTitle}>Service</ThemedText>
                </View>
                <ThemedText style={styles.serviceTitle}>{booking.ad.title}</ThemedText>
                {!shouldHidePrice(booking.ad.price) && (
                  <ThemedText style={styles.servicePrice}>{formatPrice(booking.ad.price || 0)}</ThemedText>
                )}
              </View>
            )}

            {/* Complaint Tracker - Using shared component */}
            <ComplaintTracker
              complaints={booking.complaints || []}
              userRole="SELLER"
              onOpenDiscussion={handleOpenDiscussion}
              onOpenAction={handleOpenActionModal}
              isLoading={isUpdating}
            />

            {/* Action Buttons */}
            {booking.status === 'SUBMITTED' && (
              <View style={styles.actionCard}>
                <View style={styles.actionCardHeader}>
                  <MaterialIcons name="pending-actions" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.actionCardTitle}>Confirm or Reject Booking</ThemedText>
                </View>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.actionButtonPrimary}
                    onPress={() => {
                                      handleUpdateStatus('CONFIRMED');
                    }}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.primary, Colors.light.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionButtonGradient}
                    >
                      <View style={styles.actionButtonContent}>
                        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                        <ThemedText style={styles.actionButtonPrimaryText}>Confirm</ThemedText>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButtonSecondary}
                    onPress={() => {
                                      handleUpdateStatus('CANCELLED');
                    }}
                    disabled={isUpdating}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="cancel" size={20} color="#FF3B30" />
                    <ThemedText style={styles.actionButtonSecondaryText}>Reject</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Cancellation Request Action Buttons */}
            {booking.status === 'CANCELLATION_REQUESTED' && (
              <View style={styles.actionCard}>
                <View style={styles.actionCardHeader}>
                  <MaterialIcons name="event-busy" size={20} color="#FF9500" />
                  <ThemedText style={styles.actionCardTitle}>Cancellation Requested</ThemedText>
                </View>
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.actionButtonPrimary}
                    onPress={() => handleUpdateStatus('APPROVE_CANCELLATION')}
                    disabled={isUpdating}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#34C759', '#28A745']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionButtonGradient}
                    >
                      <View style={styles.actionButtonContent}>
                        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                        <ThemedText style={styles.actionButtonPrimaryText}>Approve</ThemedText>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButtonSecondary}
                    onPress={() => handleUpdateStatus('REJECT_CANCELLATION')}
                    disabled={isUpdating}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="block" size={20} color="#FF3B30" />
                    <ThemedText style={styles.actionButtonSecondaryText}>Reject</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

                </View>
              </View>

              {isDesktop && (
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                  position={PlatformAdPosition.RIGHT}
                />
              )}
            </View>
            {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" />}
            <Footer />
          </ScrollView>
        </ThemedView>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        destructive={confirmDialog.destructive}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />

      {/* Rejection Reason Modal */}
      <Modal
        visible={rejectionReasonDialog.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setRejectionReasonDialog({ visible: false });
          setRejectionReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Reason for Rejection</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              {confirmDialog.status === 'CANCELLED'
                ? 'Please provide a reason for rejecting this booking'
                : 'Please provide a reason for rejecting this cancellation request'}
            </ThemedText>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason..."
              placeholderTextColor={Colors.light.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setRejectionReasonDialog({ visible: false });
                  setRejectionReason('');
                }}
              >
                <ThemedText style={styles.modalButtonCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleRejectWithReason}
              >
                <ThemedText style={styles.modalButtonConfirmText}>
                  {confirmDialog.status === 'CANCELLED' ? 'Reject Booking' : 'Reject Cancellation'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complaint Modals */}
      <ComplaintModals
        // Discussion
        discussionVisible={discussionModalVisible}
        onCloseDiscussion={handleCloseDiscussion}
        selectedComplaint={selectedComplaint}
        messages={messages}
        messageText={messageText}
        onMessageTextChange={setMessageText}
        onSendMessage={handleSendMessage}
        onRefreshMessages={handleRefreshMessages}
        isDesktop={isDesktop}

        // Response - not used, seller responds via discussion
        responseVisible={false}
        onCloseResponse={() => {}}
        responseText=""
        onResponseTextChange={() => {}}
        onSubmitResponse={() => {}}
        isSubmittingResponse={false}

        // Action
        actionVisible={actionModalVisible}
        onCloseAction={handleCloseActionModal}
        resolutionNote={resolutionNote}
        onResolutionNoteChange={setResolutionNote}
        onResolveWithRefund={handleResolveWithRefund}
        onCompleteWithoutRefund={handleCompleteWithoutRefund}
        isProcessingAction={isProcessing}

        // File Complaint - not used by seller
        fileComplaintVisible={false}
        onCloseFileComplaint={() => {}}
        complaintDescription=""
        onComplaintDescriptionChange={() => {}}
        onSubmitComplaint={() => {}}
        isSubmittingComplaint={false}
      />
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  desktopHomeWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  content: {
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  desktopContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  backLink: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  // Unified header style matching buyer's view
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Unified card style
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  // Customer info - simplified to match buyer's view
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  customerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  contactText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  // Quick contact buttons
  quickContactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickContactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary + '10',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary + '30',
  },
  quickContactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  quickContactWhatsApp: {
    backgroundColor: '#25D366' + '15',
    borderColor: '#25D366' + '40',
  },
  // Info rows matching buyer's view
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 22,
  },
  infoTime: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 16,
  },
  bookingIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingId: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // Service card matching buyer's view
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: Colors.light.text,
    lineHeight: 24,
  },
  servicePrice: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  // Auto-process card
  autoProcessCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  autoProcessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoProcessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  autoProcessText: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  autoProcessDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  autoProcessDateText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 6,
  },
  // Action Card
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonPrimary: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  actionButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FF3B30',
    backgroundColor: '#FFF5F5',
  },
  actionButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: -0.3,
  },
  // Actions matching buyer's view
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  rejectButton: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FF3B30',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: -0.3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalButtonConfirm: {
    backgroundColor: '#FF3B30',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  transactionStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
