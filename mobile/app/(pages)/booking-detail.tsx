import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { bookingsService, complaintsService } from '@/services';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { Footer } from '@/components/footer';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { GradientButton } from '@/components/ui/gradient-button';
import { Colors } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';
import { useAlert } from '@/components/ui/custom-alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { config } from '@/config/environment';
import { useAuth } from '@/contexts/auth-context';
import { ComplaintTracker, Complaint, ComplaintModals } from '@/components/complaint-components';
import { useBackNavigation, FALLBACK_ROUTES } from '@/utils/navigation-helpers';

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

export default function BookingDetailPage() {
  const router = useRouter();
  const { goBack } = useBackNavigation(FALLBACK_ROUTES.BOOKING_DETAIL);
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [autoCompleteDays, setAutoCompleteDays] = useState(7);
  const [autoCancelDays, setAutoCancelDays] = useState(3);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // State to determine if current user is seller or buyer
  const [isSeller, setIsSeller] = useState(false);
  const [isBuyer, setIsBuyer] = useState(false);
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
  
  // File Complaint state
  const [complaintDialogVisible, setComplaintDialogVisible] = useState(false);
  const [complaintDescription, setComplaintDescription] = useState('');
  
  // Messaging state for complaint discussions
  const [discussionModalVisible, setDiscussionModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [messages, setMessages] = useState<ComplaintMessage[]>([]);
  const [messageText, setMessageText] = useState('');

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  useEffect(() => {
    const onChange = (result: any) => setScreenWidth(result.window.width);
    const handler = Platform.OS === 'web' ? Dimensions.addEventListener('change', onChange) : null;
    return () => handler?.remove();
  }, []);

  useEffect(() => {
    const fetchBooking = async () => {
      if (params.id && user) {
        try {
          const response = await bookingsService.getBooking(params.id as string);
              if (response.success && response.data) {
            setBooking(response.data);
            
            // Determine if current user is seller or buyer
            if (user && user.id) {
              if (user.id === response.data.user?.id) {
                setIsBuyer(true);
                setIsSeller(false);
              } else if (user.id === response.data.ad?.user?.id) {
                setIsSeller(true);
                setIsBuyer(false);
              } else {
                // User is neither buyer nor seller - shouldn't happen in normal flow
                setIsBuyer(false);
                setIsSeller(false);
              }
            } else {
              // User not loaded yet or not authenticated
              setIsBuyer(false);
              setIsSeller(false);
            }
          }
        } catch (error) {
            } finally {
          setIsLoading(false);
        }
      } else {
        }
    };
    fetchBooking();
  }, [params.id, user]);

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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/public/system-settings`);
        const data = await response.json();
        if (data.success && data.data) {
          setAutoCompleteDays(data.data.autoCompleteBookingDays || 7);
          setAutoCancelDays(data.data.autoCancelBookingDays || 3);
        }
      } catch (error) {
        }
    };
    fetchSettings();
  }, []);

  // Check if booking has an active complaint
  const hasActiveComplaint = () => {
    if (!booking?.complaints || booking.complaints.length === 0) return false;
    return booking.complaints.some((c: Complaint) =>
      c.status === 'OPEN' ||
      c.status === 'INVESTIGATING'
    );
  };

  // Calculate auto-complete/auto-cancel dates
  const getAutoProcessInfo = () => {
    if (!booking) return null;

    // Don't auto-process if there's an active complaint
    if (hasActiveComplaint()) return null;

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

  const handleUpdateStatus = async (status: string) => {
    // For CONFIRMED bookings, it's a cancellation request (needs seller approval)
    // For SUBMITTED bookings, it's a direct cancellation
    const isConfirmed = booking.status === 'CONFIRMED';
    const messages: any = {
      COMPLETED: { title: 'Complete Booking', message: 'Mark this booking as completed?' },
      CANCELLED: {
        title: isConfirmed ? 'Request Cancellation' : 'Cancel Booking',
        message: isConfirmed
          ? 'Your cancellation request will be sent to the seller for approval'
          : 'Are you sure you want to cancel this booking?',
        destructive: true
      },
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

    // Handle complaint actions
    if (status === 'CANCEL_COMPLAINT' || status === 'RESOLVE_COMPLAINT') {
      await processComplaintAction();
      return;
    }

    try {
      setIsUpdating(true);
      let response;

      if (status === 'COMPLETED') {
        response = await bookingsService.completeBooking(booking.id);
      } else if (status === 'CANCELLED') {
        response = await bookingsService.cancelBooking(booking.id);
      }

      if (response?.success) {
        // Use the API response message if available, otherwise use default
        const successMessage = response?.message || `Booking ${status.toLowerCase()}`;
        showAlert({ title: 'Success', message: successMessage, type: 'success' });
        // Refresh booking data
        const updatedResponse = await bookingsService.getBooking(params.id as string);
        if (updatedResponse.success && updatedResponse.data) {
          setBooking(updatedResponse.data);
        }
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error?.message || 'Failed to update booking', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if complaint can be filed (booking date has passed for CONFIRMED bookings)
  const canFileComplaint = () => {
    if (!booking || booking.status !== 'CONFIRMED') return false;
    const now = new Date();
    const bookingEndDate = new Date(booking.endDate);
    return now > bookingEndDate;
  };

  // Contact handlers
  const getContactUser = () => {
    return isBuyer ? booking.ad?.user : booking.user;
  };

  const handleCall = () => {
    const contactUser = getContactUser();
    if (contactUser?.phone) {
      Linking.openURL(`tel:${contactUser.phone}`);
    }
  };

  const handleWhatsApp = () => {
    const contactUser = getContactUser();
    if (contactUser?.phone) {
      const cleanPhone = contactUser.phone.replace(/[^0-9]/g, '');
      // Add India country code (91) if not present
      const phoneWithCountryCode = cleanPhone.startsWith('91') 
        ? cleanPhone 
        : `91${cleanPhone.replace(/^0/, '')}`;
      Linking.openURL(`https://wa.me/${phoneWithCountryCode}`);
    }
  };

  const handleFileComplaint = () => {
    setComplaintDialogVisible(true);
  };

  const handleCloseFileComplaint = () => {
    setComplaintDialogVisible(false);
    setComplaintDescription('');
  };

  const handleSubmitComplaint = async () => {
    if (!complaintDescription.trim()) {
      showAlert({ title: 'Error', message: 'Please provide a description for your complaint', type: 'error' });
      return;
    }

    if (complaintDescription.length < 10) {
      showAlert({ title: 'Error', message: 'Description must be at least 10 characters', type: 'error' });
      return;
    }

    try {
      setIsUpdating(true);
      const response = await complaintsService.createComplaint({
        bookingId: booking.id,
        description: complaintDescription,
      });

      if (response?.success) {
        setComplaintDescription('');
        setComplaintDialogVisible(false);

        // Refresh booking data to show the complaint
        const updatedResponse = await bookingsService.getBooking(params.id as string);
        if (updatedResponse.success && updatedResponse.data) {
          setBooking(updatedResponse.data);
        }

        showAlert({
          title: 'Complaint Filed',
          message: response?.message || 'Your complaint has been filed successfully. Our team will review it shortly.',
          type: 'success'
        });
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error?.message || 'Failed to file complaint', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

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
        const updatedResponse = await bookingsService.getBooking(params.id as string);
        if (updatedResponse.success && updatedResponse.data) {
          setBooking(updatedResponse.data);
        }
      } else {
        showAlert({ title: 'Error', message: response.message || 'Failed to send message', type: 'error' });
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to send message', type: 'error' });
    }
  };

  // Handle cancel complaint
  const handleCancelComplaint = async (complaint: Complaint) => {
    setConfirmDialog({
      visible: true,
      title: 'Cancel Complaint',
      message: 'Are you sure you want to cancel this complaint? This action cannot be undone.',
      status: 'CANCEL_COMPLAINT',
    });
    setSelectedComplaint(complaint);
  };

  // Handle resolve complaint
  const handleResolveComplaint = async (complaint: Complaint) => {
    setConfirmDialog({
      visible: true,
      title: 'Resolve Complaint',
      message: 'Mark this complaint as resolved? This indicates that the issue has been settled to your satisfaction.',
      status: 'RESOLVE_COMPLAINT',
    });
    setSelectedComplaint(complaint);
  };

  // Process complaint action
  const processComplaintAction = async () => {
    const { status } = confirmDialog;
    setConfirmDialog({ ...confirmDialog, visible: false });

    if (!selectedComplaint) return;

    try {
      setIsUpdating(true);

      if (status === 'CANCEL_COMPLAINT') {
        // Note: This endpoint needs to be implemented in the backend
        showAlert({ title: 'Info', message: 'Cancel complaint feature is coming soon', type: 'info' });
      } else if (status === 'RESOLVE_COMPLAINT') {
        // Use closeComplaint to mark complaint as resolved (buyer only)
        const response = await complaintsService.closeComplaint(
          selectedComplaint.id,
          'Complaint resolved by customer'
        );

        if (response?.success) {
          showAlert({ title: 'Success', message: 'Complaint resolved successfully', type: 'success' });
          const updatedResponse = await bookingsService.getBooking(params.id as string);
          if (updatedResponse.success && updatedResponse.data) {
            setBooking(updatedResponse.data);
          }
        }
      }
    } catch (error: any) {
      showAlert({ title: 'Error', message: error?.message || 'Failed to process action', type: 'error' });
    } finally {
      setIsUpdating(false);
      setSelectedComplaint(null);
    }
  };

  if (isLoading) {
    return (
      <AuthProtection>
        <DesktopProfileLayout>
          <ThemedView style={styles.container}>
            <View style={styles.loadingContainer}>
              <ThemedText>Loading...</ThemedText>
            </View>
          </ThemedView>
        </DesktopProfileLayout>
      </AuthProtection>
    );
  }

  if (!booking) {
    return (
      <AuthProtection>
        <DesktopProfileLayout>
          <ThemedView style={styles.container}>
            <View style={styles.loadingContainer}>
              <ThemedText>Booking not found</ThemedText>
            </View>
          </ThemedView>
        </DesktopProfileLayout>
      </AuthProtection>
    );
  }

  const statusColors: any = {
    SUBMITTED: '#FF9500',
    CONFIRMED: '#007AFF',
    COMPLETED: '#34C759',
    CANCELLED: '#FF3B30',
  };

  const statusIcons: any = {
    SUBMITTED: 'schedule',
    CONFIRMED: 'check-circle',
    COMPLETED: 'check-circle-outline',
    CANCELLED: 'cancel',
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={isDesktop ? desktopStyles.wrapper : {}}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={goBack} style={styles.backButton}>
                  <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                  <ThemedText style={styles.headerTitle}>Booking Details</ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[booking.status] }]}>
                    <MaterialIcons name={statusIcons[booking.status]} size={14} color="#FFFFFF" />
                    <ThemedText style={styles.statusText}>{booking.status}</ThemedText>
                  </View>
                </View>
              </View>

              {/* Main Content */}
              <View>
                {/* Service Card */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <MaterialIcons name="shopping-bag" size={24} color={Colors.light.primary} />
                    <ThemedText style={styles.cardTitle}>Service</ThemedText>
                  </View>
                  <ThemedText style={styles.serviceTitle}>{booking.ad?.title || 'Service'}</ThemedText>
                  {!shouldHidePrice(booking.ad?.price) && (
                    <ThemedText style={styles.servicePrice}>{formatPrice(booking.ad?.price || 0)}</ThemedText>
                  )}
                </View>

                {/* Booking Info Card */}
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
                        {booking.slotId && booking.ad?.slots?.find((s: any) => s.id === booking.slotId) && (
                          <ThemedText style={styles.infoTime}>
                            {booking.ad.slots.find((s: any) => s.id === booking.slotId).startTime} - {booking.ad.slots.find((s: any) => s.id === booking.slotId).endTime}
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

                    {transactions.map((transaction) => (
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
                            {formatPrice(Number(transaction.amount))}
                          </ThemedText>
                          <View style={[styles.transactionStatusBadge, { backgroundColor: getTransactionStatusColor(transaction.status) }]}>
                            <ThemedText style={styles.transactionStatusText}>{transaction.status}</ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
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

                {/* Customer/Publisher Info Card */}
                {booking.user && (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <MaterialIcons name="person" size={24} color={Colors.light.primary} />
                      <ThemedText style={styles.cardTitle}>
                        {isBuyer ? 'Publisher' : 'Customer'}
                      </ThemedText>
                    </View>

                    <View style={styles.customerInfo}>
                      <View style={styles.avatar}>
                        <ThemedText style={styles.avatarText}>
                          {(isBuyer ? booking.ad?.user : booking.user).firstName?.charAt(0)}
                          {(isBuyer ? booking.ad?.user : booking.user).lastName?.charAt(0)}
                        </ThemedText>
                      </View>
                      <View style={styles.customerDetails}>
                        <ThemedText style={styles.customerName}>
                          {(isBuyer ? booking.ad?.user : booking.user).firstName} {(isBuyer ? booking.ad?.user : booking.user).lastName}
                        </ThemedText>
                        {(isBuyer ? booking.ad?.user : booking.user).phone && (
                          <View style={styles.contactRow}>
                            <MaterialIcons name="phone" size={16} color={Colors.light.textSecondary} />
                            <ThemedText style={styles.contactText}>{(isBuyer ? booking.ad?.user : booking.user).phone}</ThemedText>
                          </View>
                        )}
                        {(isBuyer ? booking.ad?.user : booking.user).email && (
                          <View style={styles.contactRow}>
                            <MaterialIcons name="email" size={16} color={Colors.light.textSecondary} />
                            <ThemedText style={styles.contactText}>{(isBuyer ? booking.ad?.user : booking.user).email}</ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Contact buttons - shown below info like a secondary action */}
                    {getContactUser()?.phone && (
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

                {/* Complaint Tracker - Using shared component */}
                <ComplaintTracker
                  complaints={booking.complaints || []}
                  userRole="BUYER"
                  onOpenDiscussion={handleOpenDiscussion}
                  onFileComplaint={handleFileComplaint}
                  canFileComplaint={canFileComplaint()}
                  isLoading={isUpdating}
                  onCancelComplaint={handleCancelComplaint}
                  onResolveComplaint={handleResolveComplaint}
                />

                {/* Action Buttons - Hide when active complaint exists */}
                {!hasActiveComplaint() && booking.status === 'SUBMITTED' && (
                  <View style={styles.actionCard}>
                    <View style={styles.actionCardHeader}>
                      <MaterialIcons name="pending-actions" size={20} color={Colors.light.primary} />
                      <ThemedText style={styles.actionCardTitle}>Pending Action Required</ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.actionButtonSecondary}
                      onPress={() => handleUpdateStatus('CANCELLED')}
                      disabled={isUpdating}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="event-busy" size={20} color="#FF3B30" />
                      <ThemedText style={styles.actionButtonSecondaryText}>Cancel Booking</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
                {!hasActiveComplaint() && booking.status === 'CONFIRMED' && (
                  <View style={styles.actionCard}>
                    <View style={styles.actionCardHeader}>
                      <MaterialIcons name="fact-check" size={20} color={Colors.light.primary} />
                      <ThemedText style={styles.actionCardTitle}>Booking Actions</ThemedText>
                    </View>
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={styles.actionButtonPrimary}
                        onPress={() => handleUpdateStatus('COMPLETED')}
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
                            <ThemedText style={styles.actionButtonPrimaryText}>Complete</ThemedText>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionButtonSecondary}
                        onPress={() => handleUpdateStatus('CANCELLED')}
                        disabled={isUpdating}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="event-busy" size={20} color="#FF3B30" />
                        <ThemedText style={styles.actionButtonSecondaryText}>Cancel</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
            {!isDesktop && <Footer />}
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

          // Response - not used by buyer
          responseVisible={false}
          onCloseResponse={() => {}}
          responseText=""
          onResponseTextChange={() => {}}
          onSubmitResponse={() => {}}
          isSubmittingResponse={false}

          // Action - not used by buyer (only seller can resolve)
          actionVisible={false}
          onCloseAction={() => {}}
          resolutionNote=""
          onResolutionNoteChange={() => {}}
          onResolveWithRefund={() => {}}
          onCompleteWithoutRefund={() => {}}
          isProcessingAction={false}

          // File Complaint
          fileComplaintVisible={complaintDialogVisible}
          onCloseFileComplaint={handleCloseFileComplaint}
          complaintDescription={complaintDescription}
          onComplaintDescriptionChange={setComplaintDescription}
          onSubmitComplaint={handleSubmitComplaint}
          isSubmittingComplaint={isUpdating}
        />
      </DesktopProfileLayout>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: HEADER_HEIGHT,
  },
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
  // Quick contact buttons (Call, WhatsApp)
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
  quickContactWhatsApp: {
    backgroundColor: '#25D366' + '15',
    borderColor: '#25D366' + '40',
  },
  quickContactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
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
    shadowColor: '#34C759',
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
  actionsContainer: {
    marginTop: 8,
    gap: 12,
  },
  completeButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  completeButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  completeButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  cancelButtonWrapper: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF3B30',
    elevation: 1,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cancelButtonInner: {
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  cancelButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: -0.4,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cancelButton: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FF3B30',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: -0.3,
  },
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

const desktopStyles = StyleSheet.create<any>({
  wrapper: {
    maxWidth: 700,
    marginHorizontal: 'auto',
    width: '100%',
  },
});
