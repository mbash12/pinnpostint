import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal as RNModal,
  Pressable,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { adsService, bookingsService } from '@/services';
import { useRazorpay } from '@/hooks/use-razorpay';
import { config } from '@/config/environment';
import { RazorpayWebViewModal } from '@/components/ui/razorpay-webview-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { GradientButton } from '@/components/ui/gradient-button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Footer } from '@/components/footer';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';

import { SideBanners } from '@/components/home/side-banners';
import { Colors, WebShadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { formatPrice } from '@/utils/price-formatter';
import { useAlert } from '@/components/ui/custom-alert';
import { SlotPicker } from '@/components/booking/slot-picker';
import { useAuthGuard } from '@/utils/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { platformAdsService } from '@/services';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

// Conditional import for DateTimePicker
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch {
  }
}

interface AdData {
  id: string;
  title: string;
  price: string;
  location: string;
  whatsapp?: string;
  bookingType?: 'DEFAULT' | 'SLOTS';
  slots?: any[];
  bookingStartDate?: string;
  bookingEndDate?: string;
}

export default function BookingPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [adData, setAdData] = useState<AdData>({
    id: '',
    title: '',
    price: '₹0',
    location: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingPrice, setBookingPrice] = useState(0);
  const [serviceFeeFixed, setServiceFeeFixed] = useState(0);
  const { showAlert } = useAlert();
  const { getKey, createBookingOrder, verifyPayment } = useRazorpay();
  const insets = useSafeAreaInsets();

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalOptions, setPaymentModalOptions] = useState<any>(null);
  const [pendingBookingData, setPendingBookingData] = useState<any>(null);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  const isDesktop = Platform.OS === 'web' && screenWidth > 768;

  React.useEffect(() => {
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

  React.useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);

  React.useEffect(() => {
    const fetchAdData = async () => {
      if (params.adSlug) {
        try {
          const [adResponse, settingsResponse] = await Promise.all([
            adsService.getPublicAd(params.adSlug as string),
            fetch(`${config.api.baseUrl}/public/system-settings`).then(r => r.json())
          ]);

          if (adResponse.success && adResponse.data) {
            const ad = adResponse.data;
            const formattedLocation = ad.locationFormatted || (ad.locationCity ? (ad.locationState ? `${ad.locationCity}, ${ad.locationState}` : ad.locationCity) : 'Unknown');
            setAdData({
              id: ad.id,
              title: ad.title,
              price: formatPrice(ad.price || 0),
              location: formattedLocation,
              bookingType: ad.bookingType,
              slots: ad.slots || [],
              bookingStartDate: ad.bookingStartDate || (ad.slots && !Array.isArray(ad.slots) ? ad.slots.bookingStartDate : undefined),
              bookingEndDate: ad.bookingEndDate || (ad.slots && !Array.isArray(ad.slots) ? ad.slots.bookingEndDate : undefined),
            });
          } else {
            setAdData({
              id: '',
              title: 'Service',
              price: '₹0',
              location: 'Unknown',
            });
          }

          if (settingsResponse.success && settingsResponse.data) {
            setBookingPrice(settingsResponse.data.bookingPrice || 0);
            setServiceFeeFixed(settingsResponse.data.serviceFeeFixed || 0);
          }
        } catch (error) {
              setAdData({
            id: '',
            title: 'Service',
            price: '₹0',
            location: 'Unknown',
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setAdData({
          id: '1',
          title: 'Service',
          price: '₹0',
          location: 'Unknown',
        });
        setIsLoading(false);
      }
    };

    fetchAdData();
  }, [params.adSlug]);

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    notes: '',
    slotId: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [currentPickerDate, setCurrentPickerDate] = useState(new Date());
  const [showWebPicker, setShowWebPicker] = useState(false);
  const [webPickerMode, setWebPickerMode] = useState<'date' | 'time'>('date');
  const bookingMinDate = adData.bookingStartDate || new Date().toISOString().split('T')[0];
  const bookingMaxDate = adData.bookingEndDate || undefined;

  const calculateTotal = () => {
    const baseAmount = bookingPrice;
    const serviceFee = serviceFeeFixed;
    const total = baseAmount + serviceFee;

    return {
      baseAmount,
      serviceFee,
      discount: 0,
      total,
    };
  };

  const showDatePickerHandler = () => {
    if (Platform.OS === 'web') {
      setWebPickerMode('date');
      setShowWebPicker(true);
    } else {
      // Mobile: Show native picker directly
      setDatePickerMode('date');
      setCurrentPickerDate(formData.date ? new Date(formData.date) : new Date());
      setShowDatePicker(true);
    }
  };

  const showTimePickerHandler = () => {
    if (Platform.OS === 'web') {
      setWebPickerMode('time');
      setShowWebPicker(true);
    } else {
      // Mobile: Show native picker directly
      setDatePickerMode('time');
      setCurrentPickerDate(formData.time ? new Date(`2000-01-01T${formData.time}`) : new Date());
      setShowDatePicker(true);
    }
  };

  const handlePickerChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const now = new Date();

      if (datePickerMode === 'date') {
        const minDate = new Date(bookingMinDate);
        minDate.setHours(0, 0, 0, 0);
        const maxDate = bookingMaxDate ? new Date(bookingMaxDate) : null;
        if (maxDate) maxDate.setHours(0, 0, 0, 0);
        const selectedDateMidnight = new Date(selectedDate);
        selectedDateMidnight.setHours(0, 0, 0, 0);

        if (selectedDateMidnight < minDate || (maxDate && selectedDateMidnight > maxDate)) {
          showAlert({
            title: 'Invalid Date',
            message: bookingMaxDate
              ? `Please select a date between ${bookingMinDate} and ${bookingMaxDate}`
              : `Please select a date on or after ${bookingMinDate}`,
            type: 'warning'
          });
          return;
        }

        const formattedDate = selectedDate.toISOString().split('T')[0];
        setFormData(prev => ({ ...prev, date: formattedDate }));
      } else {
        // For time picker, check if the date is today and time is in the past
        if (formData.date) {
          const selectedDateTime = new Date(`${formData.date}T${selectedDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}:00`);

          if (selectedDateTime < now) {
            showAlert({
              title: 'Invalid Time',
              message: 'Please select a future time for your booking',
              type: 'warning'
            });
            return;
          }
        }

        const formattedTime = selectedDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        setFormData(prev => ({ ...prev, time: formattedTime }));
      }
    }
  };

  const renderWebPicker = () => {
    if (!showWebPicker) return null;

    return (
      <RNModal
        transparent
        animationType="fade"
        visible={showWebPicker}
        onRequestClose={() => setShowWebPicker(false)}
      >
        <View style={styles.webPickerOverlay}>
          <Pressable 
            style={styles.webPickerBackdrop} 
            onPress={() => setShowWebPicker(false)}
          />
          <View style={styles.webPickerContainer}>
            {/* Drag Handle */}
            <View style={styles.webPickerDragHandle} />
            
            {/* Header */}
            <View style={styles.webPickerHeader}>
              <View style={styles.webPickerHeaderContent}>
                <View style={styles.webPickerIcon}>
                  <MaterialIcons 
                    name={webPickerMode === 'date' ? 'calendar-today' : 'schedule'} 
                    size={20} 
                    color={Colors.light.primary} 
                  />
                </View>
                <ThemedText style={styles.webPickerTitle}>
                  {webPickerMode === 'date' ? 'Select Date' : 'Select Time'}
                </ThemedText>
              </View>
              <TouchableOpacity 
                style={styles.webPickerCloseButton}
                onPress={() => setShowWebPicker(false)}
              >
                <MaterialIcons name="close" size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={styles.webPickerContent}>
              <View style={styles.webInputContainer}>
                <View style={styles.webInputWrapper}>
                  {webPickerMode === 'date' ? (
                    <input
                      type="date"
                      value={formData.date}
                      min={bookingMinDate}
                      max={bookingMaxDate}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (selectedDate) {
                          const enteredDate = new Date(selectedDate);
                          const minDate = new Date(bookingMinDate);
                          minDate.setHours(0, 0, 0, 0);
                          const maxDate = bookingMaxDate ? new Date(bookingMaxDate) : null;
                          if (maxDate) maxDate.setHours(0, 0, 0, 0);
                          const enteredDateMidnight = new Date(enteredDate);
                          enteredDateMidnight.setHours(0, 0, 0, 0);

                          if (
                            enteredDateMidnight < minDate ||
                            (maxDate && enteredDateMidnight > maxDate) ||
                            isNaN(enteredDateMidnight.getTime())
                          ) {
                            showAlert({
                              title: 'Invalid Date',
                              message: bookingMaxDate
                                ? `Please select a date between ${bookingMinDate} and ${bookingMaxDate}`
                                : `Please select a date on or after ${bookingMinDate}`,
                              type: 'warning'
                            });
                            return;
                          }
                        }
                        setFormData(prev => ({ ...prev, date: selectedDate }));
                      }}
                      style={styles.webNativeInput as any}
                      autoFocus
                    />
                  ) : (
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => {
                        const selectedTime = e.target.value;
                        if (selectedTime && formData.date) {
                          const now = new Date();
                          const selectedDateTime = new Date(`${formData.date}T${selectedTime}:00`);

                          if (selectedDateTime < now) {
                            showAlert({
                              title: 'Invalid Time',
                              message: 'Please select a future time',
                              type: 'warning'
                            });
                            return;
                          }
                        }
                        setFormData(prev => ({ ...prev, time: selectedTime }));
                      }}
                      style={styles.webNativeInput as any}
                      autoFocus
                    />
                  )}
                </View>
              </View>
              
              {/* Quick Select Options */}
              <View style={styles.webQuickSelect}>
                <ThemedText style={styles.webQuickSelectTitle}>Quick Select:</ThemedText>
                <View style={styles.webQuickSelectButtons}>
                  {webPickerMode === 'date' ? (
                    <>
                      <TouchableOpacity
                        style={styles.webQuickSelectButton}
                        onPress={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setFormData(prev => ({ ...prev, date: today }));
                        }}
                      >
                        <ThemedText style={styles.webQuickSelectButtonText}>Today</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.webQuickSelectButton}
                        onPress={() => {
                          const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                          setFormData(prev => ({ ...prev, date: tomorrow }));
                        }}
                      >
                        <ThemedText style={styles.webQuickSelectButtonText}>Tomorrow</ThemedText>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.webQuickSelectButton}
                        onPress={() => {
                          // Validate time is not in the past if date is today
                          if (formData.date) {
                            const now = new Date();
                            const selectedDateTime = new Date(`${formData.date}T09:00:00`);

                            if (selectedDateTime < now) {
                              showAlert({
                                title: 'Invalid Time',
                                message: '9:00 AM has already passed today. Please select a future time.',
                                type: 'warning'
                              });
                              return;
                            }
                          }
                          setFormData(prev => ({ ...prev, time: '09:00' }));
                        }}
                      >
                        <ThemedText style={styles.webQuickSelectButtonText}>9:00 AM</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.webQuickSelectButton}
                        onPress={() => {
                          // Validate time is not in the past if date is today
                          if (formData.date) {
                            const now = new Date();
                            const selectedDateTime = new Date(`${formData.date}T14:00:00`);

                            if (selectedDateTime < now) {
                              showAlert({
                                title: 'Invalid Time',
                                message: '2:00 PM has already passed today. Please select a future time.',
                                type: 'warning'
                              });
                              return;
                            }
                          }
                          setFormData(prev => ({ ...prev, time: '14:00' }));
                        }}
                      >
                        <ThemedText style={styles.webQuickSelectButtonText}>2:00 PM</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.webQuickSelectButton}
                        onPress={() => {
                          // Validate time is not in the past if date is today
                          if (formData.date) {
                            const now = new Date();
                            const selectedDateTime = new Date(`${formData.date}T18:00:00`);

                            if (selectedDateTime < now) {
                              showAlert({
                                title: 'Invalid Time',
                                message: '6:00 PM has already passed today. Please select a future time.',
                                type: 'warning'
                              });
                              return;
                            }
                          }
                          setFormData(prev => ({ ...prev, time: '18:00' }));
                        }}
                      >
                        <ThemedText style={styles.webQuickSelectButtonText}>6:00 PM</ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
            
            {/* Footer */}
            <View style={styles.webPickerFooter}>
              <TouchableOpacity
                style={[styles.webPickerButton, styles.webPickerButtonCancel]}
                onPress={() => setShowWebPicker(false)}
              >
                <MaterialIcons name="close" size={16} color={Colors.light.textSecondary} style={styles.webPickerButtonIcon} />
                <ThemedText style={styles.webPickerButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.webPickerButton, styles.webPickerButtonConfirm]}
                onPress={() => {
                  setShowWebPicker(false);
                }}
              >
                <MaterialIcons name="check" size={16} color="#FFFFFF" style={styles.webPickerButtonIcon} />
                <ThemedText style={styles.webPickerButtonTextConfirm}>Confirm</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>
    );
  };

  // Helper function for web Razorpay checkout
  const openRazorpayWeb = async (options: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          ...options,
          handler: function (response: any) {
            resolve(response);
          },
          modal: {
            ondismiss: function () {
              reject(new Error('Payment cancelled'));
            },
          },
        });
        rzp.open();
      };
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });
  };

  // Helper function to verify payment and complete booking
  const verifyAndCompleteBooking = async (
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
    bookingDataOverride?: any
  ) => {
    const data = bookingDataOverride || pendingBookingData;
    
    if (!data) {
      console.error('No booking data found for verification');
      showAlert({
        title: 'Booking Failed',
        message: 'Internal error: No booking data found. Please contact support.',
        type: 'error'
      });
      return;
    }

    try {
      const verifyResult = await verifyPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        adData.id,
        data.startDateTime,
        data.endDateTime,
        data.notes,
        data.slotId,
        data.bookingDate
      ) as any;

      if (verifyResult.verified || verifyResult.success) {
        showAlert({
          title: 'Booking Submitted',
          message: 'Your payment was successful! Booking submitted to seller for confirmation.',
          type: 'success'
        });
        setTimeout(() => {
          router.replace('/(pages)/my-bookings');
        }, 1500);
      } else {
        showAlert({
          title: 'Booking Failed',
          message: 'Payment verification failed. Please contact support.',
          type: 'error'
        });
      }
    } catch (error: any) {
      const message = error?.error?.code === 'SLOT_FULL'
        ? 'This time slot was just booked by someone else. Please select a different slot.'
        : (error.message || 'Payment verification failed. Please contact support.');

      showAlert({
        title: 'Booking Failed',
        message,
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
      setShowPaymentModal(false);
    }
  };

  // Payment modal success callback
  const handlePaymentSuccess = async (data: any) => {
    await verifyAndCompleteBooking(
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    );
  };

  // Payment modal error callback
  const handlePaymentError = (error: string) => {
    setIsProcessing(false);
    setShowPaymentModal(false);
    showAlert({
      title: 'Payment Failed',
      message: error,
      type: 'error'
    });
  };

  // Payment modal close callback
  const handlePaymentClose = () => {
    setIsProcessing(false);
    setShowPaymentModal(false);
  };

  const handleContinueToPayment = async () => {
    // Validate form
    if (adData.bookingType === 'SLOTS') {
      if (!formData.slotId || !formData.date) {
        showAlert({
          title: 'Required Fields',
          message: 'Please select both a date and a time slot for your appointment',
          type: 'warning'
        });
        return;
      }
    } else {
      if (!formData.date || !formData.time) {
        showAlert({
          title: 'Required Fields',
          message: 'Please select both date and time for your booking',
          type: 'warning'
        });
        return;
      }
    }

    // Validate date is inside ad availability range
    const now = new Date();
    const bookingDateTime = adData.bookingType === 'SLOTS'
      ? new Date(formData.date)
      : new Date(`${formData.date}T${formData.time}:00`);
    const selectedDateOnly = new Date(formData.date);
    selectedDateOnly.setHours(0, 0, 0, 0);
    const minDate = new Date(bookingMinDate);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = bookingMaxDate ? new Date(bookingMaxDate) : null;
    if (maxDate) maxDate.setHours(0, 0, 0, 0);

    if (selectedDateOnly < minDate || (maxDate && selectedDateOnly > maxDate)) {
      showAlert({
        title: 'Unavailable Date',
        message: bookingMaxDate
          ? `Bookings are available only between ${bookingMinDate} and ${bookingMaxDate}`
          : `Bookings are available only from ${bookingMinDate}`,
        type: 'warning'
      });
      return;
    }

    if (bookingDateTime < now && adData.bookingType !== 'SLOTS') {
      showAlert({
        title: 'Invalid Booking Time',
        message: 'Please select a future date and time for your booking',
        type: 'warning'
      });
      return;
    }

    if (!adData.id) {
      showAlert({
        title: 'Error',
        message: 'Service information not loaded. Please try again.',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const pricing = calculateTotal();

      // Prepare booking dates
      const startDateTime = new Date(`${formData.date}T${formData.time}:00`);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(endDateTime.getHours() + 1);

      // Step 1: Create Razorpay order with adId
      const orderData = await createBookingOrder(pricing.total, adData.id);

      // Store pending booking data for after payment
      const bookingData = {
        startDateTime: adData.bookingType === 'SLOTS' ? undefined : startDateTime.toISOString(),
        endDateTime: adData.bookingType === 'SLOTS' ? undefined : endDateTime.toISOString(),
        notes: formData.notes,
        slotId: formData.slotId,
        bookingDate: formData.date
      };
      
      setPendingBookingData(bookingData);

      // Prepare payment options
      const paymentOptions = {
        key: getKey(),
        amount: orderData.amount * 100, // Convert to paise
        currency: orderData.currency,
        name: 'Pin N Post',
        description: `Booking for ${adData.title}`,
        order_id: orderData.paymentIntentId,
        prefill: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email || '',
          contact: user?.phone || '',
        },
      };

      if (Platform.OS === 'web') {
        // Web: Use direct Razorpay checkout
        const response = await openRazorpayWeb(paymentOptions);

        // Verify payment after successful checkout
        await verifyAndCompleteBooking(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
          bookingData
        );
      } else {
        // Mobile: Show WebView modal
        setPaymentModalOptions(paymentOptions);
        setShowPaymentModal(true);
        setIsProcessing(false);
      }
    } catch (error: any) {
      setIsProcessing(false);
      setShowPaymentModal(false);

      showAlert({
        title: 'Payment Failed',
        message: error.message || 'Unable to process payment. Please try again.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const pricing = calculateTotal();

  const getSelectedSlotInfo = () => {
    if (adData.bookingType !== 'SLOTS' || !formData.slotId) return null;
    return adData.slots?.find(s => s.id === formData.slotId);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading service details...</ThemedText>
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  if (isDesktop) {
    return (
      <AuthProtection>
          <ScrollView
            style={desktopStyles.container}
            contentContainerStyle={desktopStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Desktop Header */}
          <View style={desktopStyles.desktopHeader}>
            <ThemedText style={desktopStyles.desktopTitle}>Book Service</ThemedText>
            <ThemedText style={desktopStyles.desktopSubtitle}>
              Complete your booking for {adData.title}
            </ThemedText>
          </View>

          <View style={desktopStyles.desktopHomeWrapper}>
            {isDesktop && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                position={PlatformAdPosition.LEFT}
              />
            )}

            <View style={desktopStyles.desktopMainContent}>
              <View style={desktopStyles.contentWrapper}>
                <View style={desktopStyles.bookingLayout}>
                  {/* Left Column - Service and Booking Info */}
                  <View style={desktopStyles.leftColumn}>
                    {/* Service Summary Card */}
                    <View style={desktopStyles.card}>
                      <ThemedText style={desktopStyles.sectionTitle}>Service Details</ThemedText>
                      <View style={desktopStyles.serviceContent}>
                        <View style={desktopStyles.serviceHeader}>
                          <ThemedText style={desktopStyles.serviceTitle}>{adData.title}</ThemedText>
                          {adData.price !== '₹0' && (
                            <ThemedText style={desktopStyles.servicePrice}>{adData.price}</ThemedText>
                          )}
                        </View>
                        <View style={desktopStyles.serviceMeta}>
                          <View style={desktopStyles.serviceLocation}>
                            <MaterialIcons name="location-on" size={20} color={Colors.light.primary} />
                            <ThemedText style={desktopStyles.serviceLocationText}>{adData.location}</ThemedText>
                          </View>
                        </View>

                        {(formData.date || formData.slotId) && (
                          <View style={desktopStyles.selectionSummary}>
                            <View style={desktopStyles.selectionItem}>
                              <MaterialIcons name="event" size={16} color={Colors.light.primary} />
                              <ThemedText style={desktopStyles.selectionText}>
                                {formatDateLabel(formData.date)}
                              </ThemedText>
                            </View>
                            {adData.bookingType === 'SLOTS' ? (
                              getSelectedSlotInfo() && (
                                <View style={desktopStyles.selectionItem}>
                                  <MaterialIcons name="schedule" size={16} color={Colors.light.primary} />
                                  <ThemedText style={desktopStyles.selectionText}>
                                    {getSelectedSlotInfo()?.startTime} - {getSelectedSlotInfo()?.endTime}
                                  </ThemedText>
                                </View>
                              )
                            ) : (
                              formData.time && (
                                <View style={desktopStyles.selectionItem}>
                                  <MaterialIcons name="schedule" size={16} color={Colors.light.primary} />
                                  <ThemedText style={desktopStyles.selectionText}>{formData.time}</ThemedText>
                                </View>
                              )
                            )}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Booking Information */}
                <View style={desktopStyles.card}>
                  <ThemedText style={desktopStyles.sectionTitle}>Booking Information</ThemedText>

                  <View style={desktopStyles.bookingFields}>
                    <View style={desktopStyles.fieldGroup}>
                      <ThemedText style={desktopStyles.fieldLabel}>Select Appointment Time</ThemedText>
                      {adData.bookingType === 'SLOTS' ? (
                        <SlotPicker
                          slots={adData.slots || []}
                          selectedDate={formData.date}
                          selectedSlotId={formData.slotId}
                          onDateChange={(date) => setFormData(prev => ({ ...prev, date }))}
                          onSlotSelect={(slotId) => setFormData(prev => ({ ...prev, slotId }))}
                        />
                      ) : (
                        <View style={desktopStyles.row}>
                          <View style={desktopStyles.halfWidth}>
                            {Platform.OS === 'web' ? (
                              <TouchableOpacity
                                style={desktopStyles.pickerButton}
                                onPress={showDatePickerHandler}
                              >
                                <View style={desktopStyles.pickerContent}>
                                  <MaterialIcons name="calendar-today" size={20} color={Colors.light.primary} />
                                  <ThemedText style={formData.date ? desktopStyles.pickerValue : desktopStyles.pickerPlaceholder}>
                                    {formData.date || 'Date *'}
                                  </ThemedText>
                                </View>
                              </TouchableOpacity>
                            ) : (
                              <View style={desktopStyles.pickerButton}>
                                <DateTimePicker
                                  value={formData.date ? new Date(formData.date) : new Date()}
                                  mode="date"
                                  display="default"
                                  onChange={(event: any, selectedDate?: Date) => {
                                    if (selectedDate) {
                                      const formattedDate = selectedDate.toISOString().split('T')[0];
                                      setFormData(prev => ({ ...prev, date: formattedDate }));
                                    }
                                  }}
                                  minimumDate={new Date()}
                                  style={desktopStyles.dateTimePicker}
                                />
                              </View>
                            )}
                          </View>
                          <View style={desktopStyles.halfWidth}>
                            {Platform.OS === 'web' ? (
                              <TouchableOpacity
                                style={desktopStyles.pickerButton}
                                onPress={showTimePickerHandler}
                              >
                                <View style={desktopStyles.pickerContent}>
                                  <MaterialIcons name="schedule" size={20} color={Colors.light.primary} />
                                  <ThemedText style={formData.time ? desktopStyles.pickerValue : desktopStyles.pickerPlaceholder}>
                                    {formData.time || 'Time *'}
                                  </ThemedText>
                                </View>
                              </TouchableOpacity>
                            ) : (
                              <View style={desktopStyles.pickerButton}>
                                <DateTimePicker
                                  value={formData.time ? new Date(`2000-01-01T${formData.time}`) : new Date()}
                                  mode="time"
                                  display="default"
                                  onChange={(event: any, selectedTime?: Date) => {
                                    if (selectedTime) {
                                      const formattedTime = selectedTime.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                      });
                                      setFormData(prev => ({ ...prev, time: formattedTime }));
                                    }
                                  }}
                                  style={desktopStyles.dateTimePicker}
                                />
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>

                    <View style={desktopStyles.fieldGroup}>
                      <ThemedText style={desktopStyles.fieldLabel}>Additional Notes</ThemedText>
                      <FloatingLabelInput
                        label="Any special requirements or instructions..."
                        value={formData.notes}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                        multiline
                        numberOfLines={4}
                        containerStyle={desktopStyles.notesContainer}
                      />
                    </View>
                  </View>
                </View>

              </View>

              {/* Right Column - Price and Action */}
              <View style={desktopStyles.rightColumn}>
                <View style={desktopStyles.stickyCard}>
                  {pricing.baseAmount > 0 && (
                    <View style={desktopStyles.priceCard}>
                      <ThemedText style={desktopStyles.sectionTitle}>Price Details</ThemedText>

                      <View style={desktopStyles.priceContent}>
                        <View style={desktopStyles.priceItem}>
                          <View style={desktopStyles.priceItemLeft}>
                            <ThemedText style={desktopStyles.priceLabel}>Service Amount</ThemedText>
                            <ThemedText style={desktopStyles.priceDescription}>Base price for the service</ThemedText>
                          </View>
                          <ThemedText style={desktopStyles.priceValue}>{formatPrice(pricing.baseAmount)}</ThemedText>
                        </View>

                        {pricing.serviceFee > 0 && (
                          <View style={desktopStyles.priceItem}>
                            <View style={desktopStyles.priceItemLeft}>
                              <ThemedText style={desktopStyles.priceLabel}>Service Fee</ThemedText>
                              <ThemedText style={desktopStyles.priceDescription}>Platform fee</ThemedText>
                            </View>
                            <ThemedText style={desktopStyles.priceValue}>{formatPrice(pricing.serviceFee)}</ThemedText>
                          </View>
                        )}


                        <View style={desktopStyles.priceDivider} />

                        <View style={desktopStyles.totalRow}>
                          <View style={desktopStyles.totalLeft}>
                            <ThemedText style={desktopStyles.totalLabel}>Total Amount</ThemedText>
                            <ThemedText style={desktopStyles.totalDescription}>Including all taxes</ThemedText>
                          </View>
                          <ThemedText style={desktopStyles.totalValue}>{formatPrice(pricing.total)}</ThemedText>
                        </View>
                      </View>
                    </View>
                  )}

                  <View style={desktopStyles.actionSection}>
                  <GradientButton
                    title="Continue to Payment"
                    onPress={handleContinueToPayment}
                    loading={isProcessing}
                    disabled={isProcessing}
                    style={desktopStyles.continueButton}
                  />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

            {isDesktop && (
              <SideBanners
                ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
                position={PlatformAdPosition.RIGHT}
              />
            )}
          </View>

          <Footer />
        </ScrollView>

        {/* DateTime Picker */}
        {DateTimePicker && showDatePicker && Platform.OS !== 'web' && (
          <DateTimePicker
            value={currentPickerDate}
            mode={datePickerMode}
            display="default"
            onChange={handlePickerChange}
            minimumDate={datePickerMode === 'date' ? new Date(bookingMinDate) : undefined}
            maximumDate={datePickerMode === 'date' && bookingMaxDate ? new Date(bookingMaxDate) : undefined}
            accentColor={Colors.light.primary}
          />
        )}
        
        {/* Web Picker Modal */}
        {renderWebPicker()}

        {/* Razorpay WebView Modal for Mobile */}
        {Platform.OS !== 'web' && paymentModalOptions && (
          <RazorpayWebViewModal
            visible={showPaymentModal}
            options={paymentModalOptions}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onClose={handlePaymentClose}
          />
        )}
      </AuthProtection>
    );
  }

  return (
    <AuthProtection>
      <ThemedView style={styles.container}>
        {/* Scrollable Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <MobilePlatformBanners ads={platformAds} position="top" style={{ marginVertical: 8 }} />

        {/* Service Summary Card */}
        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Service Details</ThemedText>
          <View style={styles.serviceInfo}>
            <ThemedText style={styles.serviceTitle}>{adData.title}</ThemedText>
            <View style={styles.serviceMeta}>
              <View style={styles.serviceLocation}>
                <MaterialIcons name="location-on" size={18} color={Colors.light.primary} />
                <ThemedText style={styles.serviceLocationText}>{adData.location}</ThemedText>
              </View>
              {adData.price !== '₹0' && (
                <ThemedText style={styles.servicePrice}>{adData.price}</ThemedText>
              )}
            </View>

            {(formData.date || formData.slotId) && (
              <View style={styles.selectionSummary}>
                <View style={styles.selectionItem}>
                  <MaterialIcons name="event" size={14} color={Colors.light.primary} />
                  <ThemedText style={styles.selectionText}>
                    {formatDateLabel(formData.date)}
                  </ThemedText>
                </View>
                {adData.bookingType === 'SLOTS' ? (
                  getSelectedSlotInfo() && (
                    <View style={styles.selectionItem}>
                      <MaterialIcons name="schedule" size={14} color={Colors.light.primary} />
                      <ThemedText style={styles.selectionText}>
                        {getSelectedSlotInfo()?.startTime} - {getSelectedSlotInfo()?.endTime}
                      </ThemedText>
                    </View>
                  )
                ) : (
                  formData.time && (
                    <View style={styles.selectionItem}>
                      <MaterialIcons name="schedule" size={14} color={Colors.light.primary} />
                      <ThemedText style={styles.selectionText}>{formData.time}</ThemedText>
                    </View>
                  )
                )}
              </View>
            )}
          </View>
        </View>

                {/* Booking Information */}
                <View style={styles.card}>
                  <ThemedText style={styles.sectionTitle}>Booking Information</ThemedText>

                  {adData.bookingType === 'SLOTS' ? (
                    <SlotPicker
                      slots={adData.slots || []}
                      selectedDate={formData.date}
                      selectedSlotId={formData.slotId}
                      onDateChange={(date) => setFormData(prev => ({ ...prev, date }))}
                      onSlotSelect={(slotId) => setFormData(prev => ({ ...prev, slotId }))}
                    />
                  ) : (
                    <View style={styles.row}>
                      <View style={styles.halfWidth}>
                        <TouchableOpacity
                          style={styles.pickerButton}
                          onPress={showDatePickerHandler}
                        >
                          <View style={styles.pickerContent}>
                            <MaterialIcons name="calendar-today" size={20} color={Colors.light.primary} />
                            <ThemedText style={formData.date ? styles.pickerValue : styles.pickerPlaceholder}>
                              {formData.date || 'Date *'}
                            </ThemedText>
                          </View>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.halfWidth}>
                        <TouchableOpacity
                          style={styles.pickerButton}
                          onPress={showTimePickerHandler}
                        >
                          <View style={styles.pickerContent}>
                            <MaterialIcons name="schedule" size={20} color={Colors.light.primary} />
                            <ThemedText style={formData.time ? styles.pickerValue : styles.pickerPlaceholder}>
                              {formData.time || 'Time *'}
                            </ThemedText>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <FloatingLabelInput
                    label="Additional Notes"
                    value={formData.notes}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                    multiline
                    numberOfLines={3}
                  />
                </View>


        {/* Price Breakdown */}
        {pricing.baseAmount > 0 && (
          <View style={styles.card}>
            <ThemedText style={styles.sectionTitle}>Price Details</ThemedText>

            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel}>Service Amount</ThemedText>
              <ThemedText style={styles.priceValue}>{formatPrice(pricing.baseAmount)}</ThemedText>
            </View>

            {pricing.serviceFee > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={styles.priceLabel}>Service Fee</ThemedText>
                <ThemedText style={styles.priceValue}>{formatPrice(pricing.serviceFee)}</ThemedText>
              </View>
            )}


            <View style={styles.priceDivider} />

            <View style={styles.priceRow}>
              <ThemedText style={styles.totalLabel}>Total Amount</ThemedText>
              <ThemedText style={styles.totalValue}>{formatPrice(pricing.total)}</ThemedText>
            </View>
          </View>
        )}
        
        {/* Spacer to ensure content is visible above button */}
        <View style={styles.buttonSpacer} />
      </ScrollView>

      <View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 16) }]}>
        <GradientButton
          title="Continue to Payment"
          onPress={handleContinueToPayment}
          loading={isProcessing}
          disabled={isProcessing}
        />
      </View>

      {/* DateTime Picker */}
      {DateTimePicker && showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={currentPickerDate}
          mode={datePickerMode}
          display="default"
          onChange={handlePickerChange}
          minimumDate={datePickerMode === 'date' ? new Date(bookingMinDate) : undefined}
          maximumDate={datePickerMode === 'date' && bookingMaxDate ? new Date(bookingMaxDate) : undefined}
          accentColor={Colors.light.primary}
        />
      )}

      {/* Web Picker Modal */}
      {renderWebPicker()}

      {/* Razorpay WebView Modal for Mobile */}
      {Platform.OS !== 'web' && paymentModalOptions && (
        <RazorpayWebViewModal
          visible={showPaymentModal}
          options={paymentModalOptions}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onClose={handlePaymentClose}
        />
      )}
      </ThemedView>
    </AuthProtection>
  );
}

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: HEADER_HEIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonSpacer: {
    height: 200,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  serviceInfo: {
    // Container for service details
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  serviceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  serviceLocationText: {
    fontSize: 13,
    color: Colors.light.text,
    marginLeft: 8,
    fontWeight: '500',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  selectionSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  dateTimePicker: {
    width: '100%',
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  pickerValue: {
    fontSize: 16,
    color: Colors.light.text,
  },
  halfWidth: {
    width: '48%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  priceValue: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  priceLabelDiscount: {
    fontSize: 15,
    color: Colors.light.primary,
  },
  priceValueDiscount: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  priceDivider: {
    height: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  continueButton: {
    marginBottom: 40,
  },
  webPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  webPickerContainer: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: WebShadows.prominent,
      },
      default: {
        elevation: 2,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  webPickerDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  webPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  webPickerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  webPickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  webPickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  webPickerContent: {
    padding: 20,
  },
  webInputContainer: {
    marginBottom: 20,
  },
  webInputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  webInput: {
    width: '100%',
    paddingTop: 16,
    paddingRight: 48,
    paddingBottom: 16,
    paddingLeft: 16,
    fontSize: '16px',
    fontWeight: '500',
    border: `2px solid ${Colors.light.border}`,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    color: Colors.light.text,
    boxSizing: 'border-box',
    outlineWidth: 0,
    outlineStyle: 'none',
    transition: 'all 0.2s ease',
    appearance: 'none',
  },
  webNativeInput: {
    width: '100%',
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    fontSize: '16px',
    fontWeight: '500',
    border: `2px solid ${Colors.light.border}`,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    color: Colors.light.text,
    boxSizing: 'border-box',
    outlineWidth: 0,
    outlineStyle: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  webInputIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  webQuickSelect: {
    marginTop: 8,
  },
  webQuickSelectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  webQuickSelectButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  webQuickSelectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  webQuickSelectButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  webPickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: 12,
  },
  webPickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
  },
  webPickerButtonCancel: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  webPickerButtonConfirm: {
    backgroundColor: Colors.light.primary,
    boxShadow: WebShadows.primary,
  },
  webPickerButtonIcon: {
    fontSize: 16,
  },
  webPickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  webPickerButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// Desktop Styles
const desktopStyles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
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
  desktopHeader: {
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  desktopTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },
  desktopSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  contentWrapper: {
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  bookingLayout: {
    flexDirection: 'row',
    gap: 40,
    maxWidth: 1000,
    width: '100%',
  },
  leftColumn: {
    flex: 2,
    maxWidth: 760,
  },
  rightColumn: {
    flex: 1,
    minWidth: 380,
    maxWidth: 400,
  },
  stickyCard: {
    position: 'sticky',
    top: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    boxShadow: WebShadows.medium,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 28,
  },
  serviceInfo: {
    // Container for service details
  },
  serviceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  serviceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  serviceLocationText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 10,
    fontWeight: '500',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  selectionSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    gap: 24,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  servicePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerButton: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
    marginBottom: 20,
    minHeight: 68,
    justifyContent: 'center',
  },
  dateTimePicker: {
    width: '100%',
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  pickerValue: {
    fontSize: 16,
    color: Colors.light.text,
  },
  halfWidth: {
    width: '48%',
  },
  notesContainer: {
    marginBottom: 0,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  priceValue: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  priceLabelDiscount: {
    fontSize: 16,
    color: Colors.light.primary,
  },
  priceValueDiscount: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  priceDivider: {
    height: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    marginVertical: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  continueButton: {
    marginTop: 32,
    height: 60,
    borderRadius: 16,
  },
  // Enhanced Layout Styles
  serviceContent: {
    // Container for service content
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  bookingFields: {
    // Container for booking fields
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  priceCard: {
    // Enhanced price card container
  },

  priceContent: {
    // Container for price content
  },
  priceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  priceItemLeft: {
    flex: 1,
  },
  priceDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  priceItemDiscount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  discountValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  totalLeft: {
    flex: 1,
  },
  totalDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  actionSection: {
    // Container for action buttons and badges
  },

});
