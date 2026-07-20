/**
 * DEPRECATED: This page is not currently used in the app flow.
 * Payment is handled directly in the booking.tsx page using Razorpay.
 * This file is kept for reference and potential future payment gateway options.
 * 
 * Current payment flow:
 * 1. User fills booking form in booking.tsx
 * 2. Payment is processed via Razorpay in booking.tsx
 * 3. Booking is created after successful payment
 * 
 * @deprecated Use booking.tsx for payment processing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { apiService } from '@/services/api.service';
import { useAlert } from '@/components/ui/custom-alert';
import { useRazorpay } from '@/hooks/use-razorpay';
import { bookingsService, adsService } from '@/services';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { GradientButton } from '@/components/ui/gradient-button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { formatPrice } from '@/utils/price-formatter';
import { Colors, WebShadows } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';
import { SideBanners } from '@/components/home/side-banners';
import { platformAdsService } from '@/services';
import type { PlatformAd } from '@/types/api.types';
import { PlatformAdPosition } from '@/types/api.types';

interface AdData {
  id: string;
  title: string;
  price: string;
  location: string;
}

interface BookingData {
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  notes: string;
}

interface PricingData {
  baseAmount: number;
  serviceFee: number;
  discount: number;
  total: number;
}

export default function PaymentPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showAlert } = useAlert();
  const { openRazorpay, createOrder, verifyPayment } = useRazorpay();
  const [isLoading, setIsLoading] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [adData, setAdData] = useState<AdData>({
    id: '',
    title: '',
    price: '₹0',
    location: '',
  });
  const [isAdDataLoading, setIsAdDataLoading] = useState(true);
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

  useEffect(() => {
    const fetchAdData = async () => {
      if (params.adSlug) {
        try {
          const response = await adsService.getPublicAd(params.adSlug as string);
          if (response.success && response.data) {
            const ad = response.data;
            setAdData({
              id: ad.id,
              title: ad.title,
              price: formatPrice(ad.price || 0),
              location: ad.location?.name || ad.location?.city || 'Unknown',
            });
          } else {
            setAdData({
              id: '',
              title: 'Service',
              price: '₹0',
              location: 'Unknown',
            });
          }
        } catch (error) {
          setAdData({
            id: '',
            title: 'Service',
            price: '₹0',
            location: 'Unknown',
          });
        } finally {
          setIsAdDataLoading(false);
        }
      } else {
        // Fallback if adSlug is not provided
        setAdData({
          id: '',
          title: 'Service',
          price: '₹0',
          location: 'Unknown',
        });
        setIsAdDataLoading(false);
      }
    };

    fetchAdData();
  }, [params.adSlug]);

  const bookingData: BookingData = params.booking ? JSON.parse(params.booking as string) : {
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    notes: '',
  };

  const pricingData: PricingData = params.pricing ? JSON.parse(params.pricing as string) : {
    baseAmount: 0,
    serviceFee: 0,
    discount: 0,
    total: 0,
  };

  // We only support Razorpay now
  const paymentGateway = 'razorpay';

  const paymentGateways = [
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Cards, UPI, NetBanking & more',
      icon: 'credit-card',
      popular: true,
    },
  ];

  const banks = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Kotak Mahindra Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Canara Bank',
  ];

  const handlePayment = async () => {
    if (!adData.id) {
      showAlert({
        title: 'Error',
        message: 'Ad information not loaded. Please try again.',
        type: 'error'
      });
      return;
    }

    setIsLoading(true);

    try {
      const orderData = await createOrder(adData.id);
      // Open Razorpay checkout
      const response = await openRazorpay({
        amount: orderData.amount,
        currency: orderData.currency,
        orderId: orderData.paymentIntentId,
        name: 'Pin N Post',
        description: `Payment for ${adData.title}`,
        prefill: {
          name: bookingData.name,
          email: bookingData.email,
          contact: bookingData.phone,
        },
      });


      const verifyResult = await verifyPayment(
        response.razorpay_order_id,
        response.razorpay_payment_id,
        response.razorpay_signature
      );

      if (verifyResult.success) {
        // Create booking after successful payment
        const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`);
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 1); // Default 1 hour booking

        const createBookingData = {
          adId: adData.id,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          notes: bookingData.notes,
        };

        const bookingResult = await bookingsService.createBooking(createBookingData);

        if (bookingResult.success) {
          showAlert({
            title: 'Payment Successful',
            message: 'Your payment has been processed successfully and your booking is confirmed',
            type: 'success'
          });
          router.replace('/(pages)/my-bookings');
        } else {
          showAlert({
            title: 'Booking Creation Failed',
            message: 'Payment was successful but booking creation failed. Please contact support.',
            type: 'error'
          });
        }
      }
    } catch (error: any) {
      showAlert({
        title: 'Payment Failed',
        message: error.message || 'Unable to initiate payment. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPaymentForm = () => {
    if (paymentGateway === 'razorpay') {
      return (
        <View style={styles.paymentForm}>
          <ThemedText style={styles.formNote}>
            Payment will be processed securely through Razorpay
          </ThemedText>
        </View>
      );
    }
    return null;
  };

  if (isAdDataLoading) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading payment details...</ThemedText>
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  if (isDesktop) {
    return (
      <AuthProtection>
        <ThemedView style={desktopStyles.container}>
          <ScrollView style={desktopStyles.content} showsVerticalScrollIndicator={false}>
            <View style={desktopStyles.desktopHomeWrapper}>
              {isDesktop && (
                <SideBanners
                  ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
                  position={PlatformAdPosition.LEFT}
                />
              )}

              <View style={desktopStyles.desktopMainContent}>
                <View style={desktopStyles.contentWrapper}>
            {/* Order Summary */}
            <View style={desktopStyles.card}>
              <ThemedText style={desktopStyles.sectionTitle}>Order Summary</ThemedText>

              <View style={desktopStyles.orderItem}>
                <View style={desktopStyles.orderInfo}>
                  <ThemedText style={desktopStyles.orderTitle}>{adData.title}</ThemedText>
                  <ThemedText style={desktopStyles.orderDate}>{bookingData.date} at {bookingData.time}</ThemedText>
                  <View style={desktopStyles.orderLocation}>
                    <MaterialIcons name="location-on" size={16} color={Colors.light.textSecondary} />
                    <ThemedText style={desktopStyles.orderLocationText}>{adData.location}</ThemedText>
                  </View>
                </View>
                <ThemedText style={desktopStyles.orderAmount}>{formatPrice(pricingData.total)}</ThemedText>
              </View>

              <View style={desktopStyles.priceBreakdown}>
                <View style={desktopStyles.priceRow}>
                  <ThemedText style={desktopStyles.priceLabel}>Service Amount</ThemedText>
                  <ThemedText style={desktopStyles.priceValue}>{formatPrice(pricingData.baseAmount)}</ThemedText>
                </View>
                <View style={desktopStyles.priceRow}>
                  <ThemedText style={desktopStyles.priceLabel}>Service Fee</ThemedText>
                  <ThemedText style={desktopStyles.priceValue}>{formatPrice(pricingData.serviceFee)}</ThemedText>
                </View>
                {pricingData.discount > 0 && (
                  <View style={desktopStyles.priceRow}>
                    <ThemedText style={desktopStyles.priceLabelDiscount}>Discount</ThemedText>
                    <ThemedText style={desktopStyles.priceValueDiscount}>-{formatPrice(pricingData.discount)}</ThemedText>
                  </View>
                )}
              </View>
            </View>

            <View style={desktopStyles.paymentLayout}>
              {/* Payment Gateway Info */}
              <View style={desktopStyles.leftColumn}>
                <View style={desktopStyles.card}>
                  <ThemedText style={desktopStyles.sectionTitle}>Payment Gateway</ThemedText>

                  <View style={[
                    desktopStyles.gatewayOption,
                    desktopStyles.gatewayOptionSelected
                  ]}>
                    <View style={desktopStyles.gatewayInfo}>
                      <View style={desktopStyles.gatewayIcon}>
                        <MaterialIcons
                          name="credit-card"
                          size={24}
                          color="#FFFFFF"
                        />
                      </View>
                      <View style={desktopStyles.gatewayDetails}>
                        <View style={desktopStyles.gatewayNameRow}>
                          <ThemedText style={[
                            desktopStyles.gatewayName,
                            desktopStyles.gatewayNameSelected
                          ]}>
                            Razorpay
                          </ThemedText>
                          <View style={desktopStyles.popularBadge}>
                            <ThemedText style={desktopStyles.popularText}>Popular</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={desktopStyles.gatewayDescription}>
                          Cards, UPI, NetBanking & more
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={desktopStyles.card}>
                    <ThemedText style={desktopStyles.sectionTitle}>Payment Method</ThemedText>
                    {renderPaymentForm()}
                  </View>
                </View>

                {/* Right Column - Total and Pay */}
                <View style={desktopStyles.rightColumn}>
                <View style={desktopStyles.totalCard}>
                  <LinearGradient
                    colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={desktopStyles.totalGradient}
                  >
                    <View>
                      <ThemedText style={desktopStyles.totalLabel}>Total Amount</ThemedText>
                      <ThemedText style={desktopStyles.totalValue}>{formatPrice(pricingData.total)}</ThemedText>
                    </View>
                    <MaterialIcons name="lock" size={32} color="#FFFFFF" />
                  </LinearGradient>
                </View>

                <GradientButton
                  title={`Pay ${formatPrice(pricingData.total)}`}
                  onPress={handlePayment}
                  loading={isLoading}
                  disabled={isLoading || !paymentGateway}
                  style={desktopStyles.payButton}
                />

                <View style={desktopStyles.securityNote}>
                  <MaterialIcons name="security" size={20} color={Colors.light.textSecondary} />
                  <ThemedText style={desktopStyles.securityText}>
                    Your payment information is secure and encrypted
                  </ThemedText>
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
        </ScrollView>
      </ThemedView>
      </AuthProtection>
    );
  }

  if (isAdDataLoading) {
    return (
      <AuthProtection>
        <ThemedView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading payment details...</ThemedText>
          </View>
        </ThemedView>
      </AuthProtection>
    );
  }

  return (
    <AuthProtection>
      <ThemedView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Order Summary</ThemedText>

          <View style={styles.orderItem}>
            <View style={styles.orderInfo}>
              <ThemedText style={styles.orderTitle}>{adData.title}</ThemedText>
              <ThemedText style={styles.orderDate}>{bookingData.date} at {bookingData.time}</ThemedText>
              <View style={styles.orderLocation}>
                <MaterialIcons name="location-on" size={14} color={Colors.light.textSecondary} />
                <ThemedText style={styles.orderLocationText}>{adData.location}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.orderAmount}>{formatPrice(pricingData.total)}</ThemedText>
          </View>

          <View style={styles.priceBreakdown}>
            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel}>Service Amount</ThemedText>
              <ThemedText style={styles.priceValue}>{formatPrice(pricingData.baseAmount)}</ThemedText>
            </View>
            <View style={styles.priceRow}>
              <ThemedText style={styles.priceLabel}>Service Fee</ThemedText>
              <ThemedText style={styles.priceValue}>{formatPrice(pricingData.serviceFee)}</ThemedText>
            </View>
            {pricingData.discount > 0 && (
              <View style={styles.priceRow}>
                <ThemedText style={styles.priceLabelDiscount}>Discount</ThemedText>
                <ThemedText style={styles.priceValueDiscount}>-{formatPrice(pricingData.discount)}</ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* Payment Gateway Info */}
        <View style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Payment Gateway</ThemedText>

          <View style={[
            styles.gatewayOption,
            styles.gatewayOptionSelected
          ]}>
            <View style={styles.gatewayInfo}>
              <View style={styles.gatewayIcon}>
                <MaterialIcons
                  name="credit-card"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.gatewayDetails}>
                <View style={styles.gatewayNameRow}>
                  <ThemedText style={[
                    styles.gatewayName,
                    styles.gatewayNameSelected
                  ]}>
                    Razorpay
                  </ThemedText>
                  <View style={styles.popularBadge}>
                    <ThemedText style={styles.popularText}>Popular</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.gatewayDescription}>
                  Cards, UPI, NetBanking & more
                </ThemedText>
              </View>
            </View>
          </View>
        </View>


        {/* Total Amount */}
        <View style={styles.totalCard}>
          <LinearGradient
            colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.totalGradient}
          >
            <View>
              <ThemedText style={styles.totalLabel}>Total Amount</ThemedText>
              <ThemedText style={styles.totalValue}>{formatPrice(pricingData.total)}</ThemedText>
            </View>
            <MaterialIcons name="lock" size={24} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <GradientButton
          title={`Pay ${formatPrice(pricingData.total)}`}
          onPress={handlePayment}
          loading={isLoading}
          disabled={isLoading || !paymentGateway}
          style={styles.payButton}
        />

        <View style={styles.securityNote}>
          <MaterialIcons name="security" size={16} color={Colors.light.textSecondary} />
          <ThemedText style={styles.securityText}>
            Your payment information is secure and encrypted
          </ThemedText>
        </View>
      </ScrollView>
      </ThemedView>
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
    paddingHorizontal: 20,
    paddingTop: HEADER_HEIGHT,
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
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  orderLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderLocationText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  priceBreakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
    paddingTop: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  priceLabelDiscount: {
    fontSize: 14,
    color: Colors.light.primary,
  },
  priceValueDiscount: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  gatewayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    marginBottom: 12,
  },
  gatewayOptionSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  gatewayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gatewayIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gatewayDetails: {
    flex: 1,
  },
  gatewayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gatewayName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginRight: 8,
  },
  gatewayNameSelected: {
    color: Colors.light.primary,
  },
  popularBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  gatewayDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: Colors.light.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  paymentMethods: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  paymentMethod: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  paymentMethodSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.text,
    marginTop: 8,
  },
  paymentForm: {
    marginTop: 8,
  },
  formNote: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  totalCard: {
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  totalGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  totalLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  payButton: {
    marginTop: 0,
    marginBottom: 20,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  securityText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
});

// Desktop Styles
const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
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
  contentWrapper: {
    maxWidth: 1000,
    marginHorizontal: 'auto',
    padding: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    boxShadow: WebShadows.medium,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 24,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  orderLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderLocationText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  orderAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  priceBreakdown: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
    paddingTop: 24,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  paymentLayout: {
    flexDirection: 'row',
    gap: 32,
  },
  leftColumn: {
    flex: 2,
  },
  rightColumn: {
    flex: 1,
    minWidth: 300,
  },
  gatewayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    marginBottom: 16,
  },
  gatewayOptionSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  gatewayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gatewayIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  gatewayDetails: {
    flex: 1,
  },
  gatewayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  gatewayName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginRight: 12,
  },
  gatewayNameSelected: {
    color: Colors.light.primary,
  },
  popularBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  gatewayDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: Colors.light.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.primary,
  },
  paymentMethods: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  paymentMethod: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 6,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodSelected: {
    backgroundColor: Colors.light.primaryLight,
    borderColor: Colors.light.primary,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginTop: 10,
  },
  paymentForm: {
    marginTop: 12,
  },
  formNote: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  totalCard: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    boxShadow: WebShadows.medium,
    elevation: 2,
  },
  totalGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 32,
  },
  totalLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 6,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  payButton: {
    marginTop: 0,
    marginBottom: 24,
    height: 56,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  securityText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginLeft: 10,
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
});
